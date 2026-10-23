import mongodb from '#services/mongodb'
import { Collection, ObjectId } from 'mongodb'

/** One document per notification shown to one shop. */
const COLLECTION = 'notifications'

/**
 * How many to keep per shop.
 *
 * The inbox is a record of what was sent, not an archive: a shopkeeper scrolling
 * back past a month of daily digests learns nothing the register does not
 * already tell them. Trimming on write keeps the collection bounded without a
 * scheduled job.
 */
const KEEP_PER_SHOP = 50

/**
 * What kind of notification this is.
 *
 * Only reminders are generated today. The field exists so that an account
 * notice — a failed email, a changed password — can sit in the same list later
 * without the page having to guess what it is looking at from the wording.
 */
export type NotificationKind = 'reminder'

/** How many cards a reminder covered, split the way the digest splits them. */
export interface NotificationCounts {
  /**
   * Cards whose expiry has run out. Optional because entries written before
   * this bucket existed have no value for it — reading them must not crash the
   * bell, and "unknown" is honestly not the same as zero.
   */
  expired?: number
  overdue: number
  dueToday: number
  dueSoon: number
  total: number
}

/** A notification as it is stored. */
export interface NotificationDocument {
  _id: ObjectId
  /** The shop this belongs to. Every query here filters on it. */
  shopkeeperId: string
  kind: NotificationKind
  title: string
  body: string
  /** Where tapping it goes, as an in-app path. */
  url: string
  counts: NotificationCounts | null
  /**
   * When it was read, or null while unread.
   *
   * A timestamp rather than a boolean because "when did they see this" is worth
   * having and costs nothing extra to store.
   */
  readAt: Date | null
  createdAt: Date
}

/** A notification as the API returns it. */
export interface PublicNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  url: string
  counts: NotificationCounts | null
  read: boolean
  createdAt: string
}

/**
 * The in-app notification list — what the bell in the app bar opens.
 *
 * Deliberately separate from push and email. Those are deliveries, and a
 * delivery can fail, be switched off, or never arrive because the phone was in
 * a basement. This is the record that the notification *happened*, and it is
 * the only one a shopkeeper can rely on being able to go back and read.
 *
 * Scoped by ShopkeeperID exactly like the card register — the titles and bodies
 * here contain customer names.
 */
class Inbox {
  get collection(): Collection<NotificationDocument> {
    return mongodb.collection<NotificationDocument>(COLLECTION)
  }

  /** Idempotent — MongoDB ignores an index that already exists. */
  async createIndexes(): Promise<void> {
    await this.collection.createIndexes([
      // Every read is "this shop's notifications, newest first".
      { key: { shopkeeperId: 1, createdAt: -1 }, name: 'inbox_shopkeeper_recent' },
      // The badge counts unread ones without scanning the shop's whole history.
      { key: { shopkeeperId: 1, readAt: 1 }, name: 'inbox_shopkeeper_unread' },
    ])
  }

  toPublic(notification: NotificationDocument): PublicNotification {
    return {
      id: notification._id.toHexString(),
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      url: notification.url,
      counts: notification.counts,
      read: notification.readAt !== null,
      createdAt: notification.createdAt.toISOString(),
    }
  }

  /**
   * Adds a notification and trims the shop's oldest beyond the cap.
   *
   * The trim runs here rather than on a schedule because this is the only place
   * the collection grows — a cap enforced at the point of writing cannot drift.
   */
  async add(
    shopkeeperId: string,
    entry: {
      kind: NotificationKind
      title: string
      body: string
      url?: string
      counts?: NotificationCounts | null
    }
  ): Promise<NotificationDocument> {
    const document: NotificationDocument = {
      _id: new ObjectId(),
      shopkeeperId,
      kind: entry.kind,
      title: entry.title,
      body: entry.body,
      url: entry.url ?? '/dashboard',
      counts: entry.counts ?? null,
      readAt: null,
      createdAt: new Date(),
    }

    await this.collection.insertOne(document)
    await this.#trim(shopkeeperId)

    return document
  }

  /** Drops this shop's notifications beyond the newest KEEP_PER_SHOP. */
  async #trim(shopkeeperId: string): Promise<void> {
    const surplus = await this.collection
      .find({ shopkeeperId })
      .sort({ createdAt: -1 })
      .skip(KEEP_PER_SHOP)
      // Only the ids are needed to delete them, and a shop's 51st-onward
      // notifications are not worth pulling bodies for.
      .project<{ _id: ObjectId }>({ _id: 1 })
      .toArray()

    if (surplus.length === 0) return

    await this.collection.deleteMany({ _id: { $in: surplus.map((doc) => doc._id) } })
  }

  /** One shop's notifications, newest first. */
  async listForShop(shopkeeperId: string, limit = KEEP_PER_SHOP): Promise<NotificationDocument[]> {
    return this.collection
      .find({ shopkeeperId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  }

  /** How many are unread. What the bell's badge shows. */
  async unreadCount(shopkeeperId: string): Promise<number> {
    return this.collection.countDocuments({ shopkeeperId, readAt: null })
  }

  /**
   * Marks one as read.
   *
   * Filtered by shop as well as by id, so knowing an id is not enough to touch
   * another shop's notification. An id that does not match simply reports false.
   */
  async markRead(shopkeeperId: string, id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false

    const result = await this.collection.updateOne(
      { _id: new ObjectId(id), shopkeeperId, readAt: null },
      { $set: { readAt: new Date() } }
    )

    return result.modifiedCount > 0
  }

  /** Marks everything unread as read. Returns how many changed. */
  async markAllRead(shopkeeperId: string): Promise<number> {
    const result = await this.collection.updateMany(
      { shopkeeperId, readAt: null },
      { $set: { readAt: new Date() } }
    )

    return result.modifiedCount
  }

  /** Every notification for a shop being deleted. Part of the cascade. */
  async deleteForShop(shopkeeperId: string): Promise<number> {
    const result = await this.collection.deleteMany({ shopkeeperId })
    return result.deletedCount
  }
}

export default new Inbox()
