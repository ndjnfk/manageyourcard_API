import mongodb from '#services/mongodb'
import hash from '@adonisjs/core/services/hash'
import { Collection, ObjectId } from 'mongodb'
import { randomBytes } from 'node:crypto'

/**
 * Administrators of the whole installation, kept in their own collection.
 *
 * Deliberately separate from `users`: an admin is not a shop with extra
 * powers, and mixing the two would mean one bad query away from a shopkeeper
 * holding admin rights. Nothing here is created by the app — there is no
 * sign-up. Admins are made from the command line with `node ace admin:create`.
 */
const COLLECTION = 'admins'

export interface AdminDocument {
  _id: ObjectId
  name: string
  /** Lower-cased, so one address cannot be registered twice. */
  email: string
  /** scrypt hash. The plain password is never stored or logged. */
  password: string
  createdAt: Date
  updatedAt: Date
}

export interface PublicAdmin {
  name: string
  email: string
  createdAt: string
}

class Admins {
  get collection(): Collection<AdminDocument> {
    return mongodb.collection<AdminDocument>(COLLECTION)
  }

  toPublic(admin: AdminDocument): PublicAdmin {
    return {
      name: admin.name,
      email: admin.email,
      createdAt: admin.createdAt.toISOString(),
    }
  }

  /** Idempotent — MongoDB ignores an index that already exists. */
  async createIndexes(): Promise<void> {
    await this.collection.createIndexes([
      { key: { email: 1 }, name: 'admin_email_unique', unique: true },
    ])
  }

  normaliseEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  async findByEmail(email: string): Promise<AdminDocument | null> {
    return this.collection.findOne({ email: this.normaliseEmail(email) })
  }

  async count(): Promise<number> {
    return this.collection.countDocuments()
  }

  /**
   * Creates an admin, or updates the password of one that already exists.
   *
   * The upsert is deliberate: the command that calls this is also how a
   * forgotten admin password gets reset, and failing on a duplicate email
   * would leave no way back in short of editing the database by hand.
   */
  async create(input: { name: string; email: string; password: string }): Promise<AdminDocument> {
    const now = new Date()
    const email = this.normaliseEmail(input.email)
    const password = await hash.make(input.password)

    const result = await this.collection.findOneAndUpdate(
      { email },
      {
        $set: { name: input.name.trim(), password, updatedAt: now },
        $setOnInsert: { _id: new ObjectId(), email, createdAt: now },
      },
      { upsert: true, returnDocument: 'after' }
    )

    return result!
  }

  /**
   * Checks an email and password, returning the admin when they match.
   *
   * The password is verified even when no admin was found, against a throwaway
   * hash. Skipping it would make "no such email" return noticeably faster than
   * "wrong password", and that timing difference is enough to work out which
   * addresses are admin accounts.
   */
  async verifyCredentials(email: string, password: string): Promise<AdminDocument | null> {
    const admin = await this.findByEmail(email)

    const matches = await hash.verify(admin?.password ?? (await this.#decoyHash()), password)

    return admin && matches ? admin : null
  }

  #decoy: Promise<string> | null = null
  #decoyHash(): Promise<string> {
    this.#decoy ??= hash.make(randomBytes(24).toString('base64url'))
    return this.#decoy
  }
}

export default new Admins()
