import mongodb from '#services/mongodb'
import env from '#start/env'
import hash from '@adonisjs/core/services/hash'
import { Collection, Filter, MongoServerError, ObjectId } from 'mongodb'
import { randomBytes } from 'node:crypto'

/**
 * The primary collection: one document per registered shop.
 */
const COLLECTION = 'users'

/**
 * Holds the counter that ShopkeeperIDs are drawn from. Kept in its own
 * collection so the sequence survives a shop being deleted — reusing a
 * ShopkeeperID would silently hand one shop another shop's cards.
 */
const COUNTERS_COLLECTION = 'counters'
const SHOPKEEPER_SEQUENCE = 'shopkeeperId'

/** Human-readable prefix, so an ID is recognisable when read aloud. */
const ID_PREFIX = 'SHP'
const ID_DIGITS = 5

/** A shop as it is stored. */
export interface ShopkeeperDocument {
  _id: ObjectId
  /**
   * The primary business key every card is later filed under. Assigned here,
   * never supplied by the client.
   */
  shopkeeperId: string
  shopName: string
  ownerName: string
  /** Normalised to bare 10 digits, so one number has exactly one spelling. */
  mobile: string
  /** Lower-cased, so "A@x.com" and "a@x.com" cannot both register. */
  email: string
  /** scrypt hash. The plain password is never stored or logged. */
  password: string
  /**
   * Filename of the uploaded profile photo, or null for none.
   *
   * Only the filename is stored, not a URL: where the API is served from can
   * change, and a stored absolute URL would rot the moment it did. The name is
   * 32 random hex characters, which is what lets the file be served without
   * authentication — see the photo route. Guessing one is not feasible, and an
   * <img src> cannot send an Authorization header.
   */
  photoFile: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * A shop as it is returned over HTTP. Note what is missing: the password, and
 * the Mongo `_id`. The shop is identified outside this service by its
 * ShopkeeperID and nothing else.
 */
export interface PublicShopkeeper {
  shopkeeperId: string
  shopName: string
  ownerName: string
  mobile: string
  email: string
  /** Absolute URL of the profile photo, or null if none has been uploaded. */
  photoUrl: string | null
  createdAt: string
}

/** The fields a profile edit may change. Anything absent is left alone. */
export interface ProfileChanges {
  shopName?: string
  ownerName?: string
  mobile?: string
}

/** What a registration supplies. Everything else is derived here. */
export interface RegisterShopkeeper {
  shopName: string
  ownerName: string
  mobile: string
  email: string
  password: string
}

/**
 * Raised when a registration collides with a shop that already exists. Carries
 * the offending field so the form can point at the right input instead of
 * showing a general failure.
 */
export class DuplicateShopkeeperError extends Error {
  constructor(readonly field: 'email' | 'mobile') {
    super(`A shop is already registered with this ${field}`)
  }
}

/** Where profile photos are served from, relative to the API's own origin. */
export const PHOTO_PATH = '/uploads/avatars'

/**
 * Absolute URL for a stored photo filename.
 *
 * Built from APP_URL rather than stored, so moving the API to another host
 * doesn't leave every shop pointing at the old one.
 */
export function photoUrlFor(photoFile: string): string {
  return `${env.get('APP_URL').replace(/\/$/, '')}${PHOTO_PATH}/${photoFile}`
}

/**
 * The shopkeeper register. Everything that touches the `users` collection goes
 * through here, so the rules that make a shop a shop — a normalised mobile, a
 * lower-cased email, a hashed password, an assigned ShopkeeperID — hold no
 * matter which controller is calling.
 */
class Shopkeepers {
  get collection(): Collection<ShopkeeperDocument> {
    return mongodb.collection<ShopkeeperDocument>(COLLECTION)
  }

  /**
   * The shop as the outside world is allowed to see it. Every endpoint that
   * returns a shop goes through here, so the password can only ever escape by
   * someone changing this one method — and `_id`, an internal detail, stays in.
   */
  toPublic(shopkeeper: ShopkeeperDocument): PublicShopkeeper {
    return {
      shopkeeperId: shopkeeper.shopkeeperId,
      shopName: shopkeeper.shopName,
      ownerName: shopkeeper.ownerName,
      mobile: shopkeeper.mobile,
      email: shopkeeper.email,
      photoUrl: shopkeeper.photoFile ? photoUrlFor(shopkeeper.photoFile) : null,
      createdAt: shopkeeper.createdAt.toISOString(),
    }
  }

  /**
   * Uniqueness is enforced by the database, not only by the validator. Two
   * registrations submitted at the same moment can both pass a "does this
   * email exist?" check and both insert; an index is the only thing that
   * actually stops the second one.
   *
   * Idempotent — MongoDB ignores an index that already exists.
   */
  async createIndexes(): Promise<void> {
    await this.collection.createIndexes([
      { key: { shopkeeperId: 1 }, name: 'shopkeeper_id_unique', unique: true },
      { key: { email: 1 }, name: 'email_unique', unique: true },
      { key: { mobile: 1 }, name: 'mobile_unique', unique: true },
    ])
  }

  /**
   * Strips the formatting a shopkeeper might type — spaces, dashes, a +91
   * country code — down to the ten digits that identify the number. Mirrors
   * the front-end's mobileValidator so both ends agree on what one number is.
   */
  normaliseMobile(mobile: string): string {
    return mobile.replace(/[\s()-]/g, '').replace(/^\+?91/, '')
  }

  normaliseEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  /**
   * Draws the next ShopkeeperID.
   *
   * findOneAndUpdate with $inc is a single atomic document update, so two
   * simultaneous registrations get two different numbers. Counting the
   * existing documents instead would hand both the same one.
   */
  async nextShopkeeperId(): Promise<string> {
    const counter = await mongodb
      .collection<{ _id: string; seq: number }>(COUNTERS_COLLECTION)
      .findOneAndUpdate(
        { _id: SHOPKEEPER_SEQUENCE },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      )

    const seq = counter?.seq ?? 1
    return `${ID_PREFIX}-${String(seq).padStart(ID_DIGITS, '0')}`
  }

  async findByEmail(email: string): Promise<ShopkeeperDocument | null> {
    return this.collection.findOne({ email: this.normaliseEmail(email) })
  }

  async findByMobile(mobile: string): Promise<ShopkeeperDocument | null> {
    return this.collection.findOne({ mobile: this.normaliseMobile(mobile) })
  }

  async findByShopkeeperId(shopkeeperId: string): Promise<ShopkeeperDocument | null> {
    return this.collection.findOne({ shopkeeperId })
  }

  /**
   * Checks an email and password against the register, returning the shop when
   * they match and null when they don't.
   *
   * The password is verified even when no shop was found, against a throwaway
   * hash. Skipping it would make "no such email" return noticeably faster than
   * "wrong password", and that timing difference is enough to work out which
   * email addresses have accounts here.
   */
  async verifyCredentials(email: string, password: string): Promise<ShopkeeperDocument | null> {
    const shopkeeper = await this.findByEmail(email)

    const matches = await hash.verify(
      shopkeeper?.password ?? (await this.#decoyHash()),
      password
    )

    return shopkeeper && matches ? shopkeeper : null
  }

  /**
   * A hash to compare against when there is no shop to compare against.
   * Computed once — hashing it per attempt would be its own timing signal, and
   * a slow one.
   */
  #decoy: Promise<string> | null = null
  #decoyHash(): Promise<string> {
    this.#decoy ??= hash.make(randomBytes(24).toString('base64url'))
    return this.#decoy
  }

  /**
   * Registers a shop and returns the stored document, ShopkeeperID included.
   *
   * @throws DuplicateShopkeeperError when the email or mobile is already taken.
   */
  async register(input: RegisterShopkeeper): Promise<ShopkeeperDocument> {
    const now = new Date()
    const document: ShopkeeperDocument = {
      _id: new ObjectId(),
      shopkeeperId: await this.nextShopkeeperId(),
      shopName: input.shopName.trim(),
      ownerName: input.ownerName.trim(),
      mobile: this.normaliseMobile(input.mobile),
      email: this.normaliseEmail(input.email),
      password: await hash.make(input.password),
      photoFile: null,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await this.collection.insertOne(document)
    } catch (error) {
      // 11000 is a unique index violation. It means another registration won
      // the race between the validator's check and this insert, so it is
      // reported the same way the validator would have.
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new DuplicateShopkeeperError(
          this.#duplicateField(error, document) ?? 'email'
        )
      }
      throw error
    }

    return document
  }

  /**
   * Edits a shop's own details — the name it trades under, the owner's name
   * and the mobile number.
   *
   * The email and the password are not here: changing either is an account
   * security matter that wants its own flow (confirming the old password,
   * verifying the new address), not a field on a profile form. Nor is the
   * ShopkeeperID, which is the key every card is filed under and can never
   * change without orphaning the register.
   *
   * @throws DuplicateShopkeeperError when the mobile belongs to another shop.
   */
  async updateProfile(
    shopkeeperId: string,
    changes: ProfileChanges
  ): Promise<ShopkeeperDocument | null> {
    const shopkeeper = await this.findByShopkeeperId(shopkeeperId)
    if (!shopkeeper) return null

    const update: Partial<ShopkeeperDocument> = { updatedAt: new Date() }

    if (changes.shopName !== undefined) update.shopName = changes.shopName.trim()
    if (changes.ownerName !== undefined) update.ownerName = changes.ownerName.trim()
    if (changes.mobile !== undefined) update.mobile = this.normaliseMobile(changes.mobile)

    try {
      await this.collection.updateOne({ _id: shopkeeper._id }, { $set: update })
    } catch (error) {
      // The unique index caught a mobile that another shop already has. The
      // validator checks this too, but only the index can win a race.
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new DuplicateShopkeeperError('mobile')
      }
      throw error
    }

    return { ...shopkeeper, ...update }
  }

  /**
   * Every shop, searchable and paged — the admin panel's list.
   *
   * The only method here that isn't scoped to one shop. It is used solely by
   * the admin controller, which sits behind its own middleware.
   */
  async search(options: {
    search?: string
    page?: number
    perPage?: number
  }): Promise<{ shopkeepers: ShopkeeperDocument[]; total: number }> {
    const { page = 1, perPage = 12 } = options
    const query: Filter<ShopkeeperDocument> = {}

    const term = options.search?.trim()
    if (term) {
      // Escaped so the text is matched literally — otherwise a stray "(" is a
      // 500 and ".*" quietly matches everything.
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      query.$or = [
        { shopkeeperId: pattern },
        { shopName: pattern },
        { ownerName: pattern },
        { email: pattern },
        { mobile: pattern },
      ]
    }

    const [found, total] = await Promise.all([
      this.collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .toArray(),
      this.collection.countDocuments(query),
    ])

    return { shopkeepers: found, total }
  }

  /**
   * An admin editing a shop.
   *
   * Wider than `updateProfile`: an admin may also change the email and reset
   * the password. Kept as its own method rather than a flag on that one, so
   * the shop's own profile route cannot be talked into doing either.
   *
   * @throws DuplicateShopkeeperError when the email or mobile is taken.
   */
  async adminUpdate(
    shopkeeperId: string,
    changes: ProfileChanges & { email?: string; password?: string }
  ): Promise<ShopkeeperDocument | null> {
    const shopkeeper = await this.findByShopkeeperId(shopkeeperId)
    if (!shopkeeper) return null

    const update: Partial<ShopkeeperDocument> = { updatedAt: new Date() }

    if (changes.shopName !== undefined) update.shopName = changes.shopName.trim()
    if (changes.ownerName !== undefined) update.ownerName = changes.ownerName.trim()
    if (changes.mobile !== undefined) update.mobile = this.normaliseMobile(changes.mobile)
    if (changes.email !== undefined) update.email = this.normaliseEmail(changes.email)
    // Hashed here, exactly as at registration — an admin-set password must be
    // no different from one the shopkeeper chose.
    if (changes.password) update.password = await hash.make(changes.password)

    try {
      await this.collection.updateOne({ _id: shopkeeper._id }, { $set: update })
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        const key = String(Object.keys(error.keyPattern ?? {}))
        throw new DuplicateShopkeeperError(key.includes('mobile') ? 'mobile' : 'email')
      }
      throw error
    }

    return { ...shopkeeper, ...update }
  }

  /**
   * Points a shop at a newly stored photo and returns the file it replaced,
   * so the caller can delete it.
   *
   * The old file is returned rather than deleted here because this service
   * owns the database row, not the disk — and a delete that fails must not
   * roll back a profile update that succeeded.
   */
  async setPhoto(shopkeeperId: string, photoFile: string | null): Promise<string | null> {
    const shopkeeper = await this.findByShopkeeperId(shopkeeperId)
    if (!shopkeeper) return null

    await this.collection.updateOne(
      { _id: shopkeeper._id },
      { $set: { photoFile, updatedAt: new Date() } }
    )

    return shopkeeper.photoFile
  }

  /**
   * Works out which field the index rejected. `keyPattern` names it directly;
   * older servers only put the index name in the message, so that is the
   * fallback.
   */
  #duplicateField(
    error: MongoServerError,
    document: ShopkeeperDocument
  ): 'email' | 'mobile' | null {
    const key = Object.keys(error.keyPattern ?? {})[0] ?? ''
    const haystack = `${key} ${error.message}`

    if (haystack.includes('mobile')) return 'mobile'
    if (haystack.includes('email')) return 'email'

    // A shopkeeperId collision is not the shopkeeper's doing and must not be
    // reported as their mistake, so it is left to bubble up as a 500.
    if (haystack.includes('shopkeeper')) return null

    return document.email ? 'email' : null
  }
}

export default new Shopkeepers()
