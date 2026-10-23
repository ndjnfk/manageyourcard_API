import mongodb from '#services/mongodb'
import { Collection, ObjectId } from 'mongodb'

/** One document per device that has agreed to receive push for some shop. */
const COLLECTION = 'pushTokens'

/**
 * Which kind of client a token came from.
 *
 * Only 'web' is issued today — the app is an installable PWA, and web push is
 * what reaches it on desktop, on Android, and on iOS 16.4+ once it has been
 * added to the home screen. The other two are here because a Capacitor shell
 * would register through the same endpoint, and a token store that has to be
 * migrated to admit them is a worse shape than one that already does.
 */
export type PushPlatform = 'web' | 'android' | 'ios'

/** A registered device, as stored. */
export interface PushTokenDocument {
  _id: ObjectId
  /**
   * The FCM registration token. Unique across the collection — see `register`
   * for why that uniqueness has to be global rather than per shop.
   */
  token: string
  /** The shop this device currently receives notifications for. */
  shopkeeperId: string
  platform: PushPlatform
  /**
   * The browser's user-agent string, trimmed.
   *
   * Kept only so a shopkeeper can tell their own devices apart when revoking
   * one — "Chrome on Windows" is recognisable in a way a 160-character token
   * never is.
   */
  userAgent: string | null
  createdAt: Date
  /**
   * Last time this token was re-registered.
   *
   * The client registers on every sign-in, so this doubles as "when was this
   * device last used". Stale tokens are also pruned by FCM rejecting them —
   * see `push.ts` — so this is for display, not for expiry.
   */
  lastSeenAt: Date
}

/** A registered device as the API returns it. The token itself never leaves. */
export interface PublicPushDevice {
  /** Enough of the token to match a row to a device, without exposing it. */
  id: string
  platform: PushPlatform
  userAgent: string | null
  createdAt: string
  lastSeenAt: string
}

/**
 * The register of devices that have agreed to receive push.
 *
 * Scoped by ShopkeeperID exactly like the card register: a lookup here decides
 * whose phone lights up, so a query that forgets the filter would send one
 * shop's customer names to another shop's device.
 */
class PushTokens {
  get collection(): Collection<PushTokenDocument> {
    return mongodb.collection<PushTokenDocument>(COLLECTION)
  }

  /** Idempotent — MongoDB ignores an index that already exists. */
  async createIndexes(): Promise<void> {
    await this.collection.createIndexes([
      // Globally unique, not unique-per-shop. A token identifies a browser
      // installation, and one browser cannot be two devices — see `register`.
      { key: { token: 1 }, name: 'push_token_unique', unique: true },
      // Every send is "every device belonging to this shop".
      { key: { shopkeeperId: 1 }, name: 'push_token_shopkeeper' },
    ])
  }

  /**
   * Records a device against a shop, or moves it if it already belongs to
   * another one.
   *
   * The upsert is keyed on the token alone, and that is the important part. An
   * FCM token identifies a browser installation, not a person: when a shop
   * signs out of a shared computer and a second shop signs in, the browser
   * hands back the *same* token. Keyed on token-plus-shop this would insert a
   * second row, and the first shop would go on receiving push — with customer
   * names in it — on a device that is now somebody else's. Keying on the token
   * alone means the newer registration takes the device over, which is the only
   * safe reading of "this browser now belongs to that shop".
   *
   * Safe to call on every sign-in, and the client does.
   */
  async register(
    shopkeeperId: string,
    token: string,
    platform: PushPlatform,
    userAgent: string | null
  ): Promise<void> {
    const now = new Date()

    await this.collection.updateOne(
      { token },
      {
        $set: {
          shopkeeperId,
          platform,
          userAgent: userAgent?.slice(0, 300) ?? null,
          lastSeenAt: now,
        },
        $setOnInsert: { _id: new ObjectId(), token, createdAt: now },
      },
      { upsert: true }
    )
  }

  /** Every device that should be pushed to for one shop. */
  async forShop(shopkeeperId: string): Promise<PushTokenDocument[]> {
    return this.collection.find({ shopkeeperId }).sort({ lastSeenAt: -1 }).toArray()
  }

  /**
   * Stops push to one device.
   *
   * Filtered by shop as well as by token so that knowing a token is not enough
   * to unregister somebody else's device.
   */
  async revoke(shopkeeperId: string, token: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ token, shopkeeperId })
    return result.deletedCount > 0
  }

  /** Stops push to every device of one shop. What turning push off does. */
  async revokeAll(shopkeeperId: string): Promise<number> {
    const result = await this.collection.deleteMany({ shopkeeperId })
    return result.deletedCount
  }

  /**
   * Drops tokens FCM has told us are dead.
   *
   * Not filtered by shop, on purpose: this is called with tokens FCM rejected
   * as unregistered, and such a token is useless to everyone. Leaving them
   * would mean every send retrying addresses that can never be delivered to.
   */
  async prune(tokens: string[]): Promise<number> {
    if (tokens.length === 0) return 0

    const result = await this.collection.deleteMany({ token: { $in: tokens } })
    return result.deletedCount
  }

  /** Removes every device of a shop being deleted. Part of the cascade. */
  async deleteForShop(shopkeeperId: string): Promise<number> {
    return this.revokeAll(shopkeeperId)
  }

  toPublic(device: PushTokenDocument): PublicPushDevice {
    return {
      // The last 12 characters are plenty to tell rows apart and useless on
      // their own — a push cannot be sent to a fragment of a token.
      id: device.token.slice(-12),
      platform: device.platform,
      userAgent: device.userAgent,
      createdAt: device.createdAt.toISOString(),
      lastSeenAt: device.lastSeenAt.toISOString(),
    }
  }
}

export default new PushTokens()
