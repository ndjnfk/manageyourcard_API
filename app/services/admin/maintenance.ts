import adminSessions from '#services/admin/sessions'
import mongodb from '#services/mongodb'
import redis from '#services/redis'

/**
 * The destructive operations behind the admin panel's side panel.
 *
 * Each is written to leave the admin still signed in. An action that logs the
 * person performing it out mid-way leaves them unable to see whether it
 * worked, which is how a "did that run?" second click ends up wiping twice.
 */

/** Everything Redis holds for shopkeepers — sessions and their per-shop index. */
const SHOPKEEPER_SESSION_PATTERNS = ['myc:session:*', 'myc:sessions:*']

/**
 * Collections that hold shop data. `admins` is deliberately not here: wiping
 * it would lock everyone out of the panel with no way back except the command
 * line.
 */
const SHOP_COLLECTIONS = [
  'users',
  'cards',
  'counters',
  'pushTokens',
  'notificationLog',
  'notifications',
]

/**
 * Signs every shopkeeper out by removing their session keys.
 *
 * A shopkeeper's session has no expiry, so this is the only thing besides
 * their own sign-out that ends one. Admin sessions live under a different
 * prefix and are untouched.
 */
export async function logOutAllShopkeepers(): Promise<number> {
  let removed = 0

  for (const pattern of SHOPKEEPER_SESSION_PATTERNS) {
    const keys = await scanKeys(pattern)
    if (keys.length === 0) continue

    removed += await redis.client.del(...keys)
  }

  return removed
}

/**
 * Empties Redis, except for the admin sessions.
 *
 * Not FLUSHDB: that would delete the key this admin is authenticated by, and
 * they would be signed out by their own maintenance action — unable to see the
 * result, and likely to sign in and run it again.
 */
export async function clearRedis(): Promise<number> {
  const spared = new Set(await adminSessions.keys())
  const all = await scanKeys('*')
  const doomed = all.filter((key) => !spared.has(key))

  if (doomed.length === 0) return 0

  return redis.client.del(...doomed)
}

/**
 * Drops every shop collection, leaving `admins` alone.
 *
 * The counters go too, so a fresh installation starts again at SHP-00001
 * rather than carrying on from wherever the wiped data had reached.
 */
export async function clearShopData(): Promise<Record<string, number>> {
  const removed: Record<string, number> = {}

  for (const name of SHOP_COLLECTIONS) {
    const result = await mongodb.collection(name).deleteMany({})
    removed[name] = result.deletedCount
  }

  // The shops are gone, so every shopkeeper session now points at nothing.
  // Leaving them would be keys that can never resolve, in a store where
  // shopkeeper sessions never expire on their own.
  await logOutAllShopkeepers()

  return removed
}

/** What deleting one shop removed. */
export interface DeletedShop {
  cards: number
  sessions: number
  counters: number
  photoRemoved: boolean
  /** Registered push devices removed. */
  devices: number
  /** Reminder log entries removed. */
  reminders: number
  /** In-app notifications removed. */
  notifications: number
}

/**
 * Deletes one shop and everything that belongs to it.
 *
 * Order matters. The shop record goes last, so a failure part-way leaves a
 * shop with some of its things missing rather than a set of orphans with no
 * shop to trace them back to — the first is repairable by hand, the second is
 * not.
 *
 * Returns null if there is no such shop.
 */
export async function deleteShop(shopkeeperId: string): Promise<DeletedShop | null> {
  const { default: shopkeepers } = await import('#services/shopkeepers')
  const { default: cards } = await import('#services/cards')
  const { default: sessions } = await import('#services/sessions')
  const { default: pushTokens } = await import('#services/push_tokens')
  const { default: reminders } = await import('#services/reminders')
  const { deletePhoto } = await import('#services/photo_storage')

  const shopkeeper = await shopkeepers.findByShopkeeperId(shopkeeperId)
  if (!shopkeeper) return null

  const cardsRemoved = await cards.collection.deleteMany({ shopkeeperId })
  const sessionsRemoved = await sessions.destroyAllFor(shopkeeperId)

  // The device tokens are the part that actually matters here. A token left
  // behind is a browser still subscribed to a shop that no longer exists — and
  // if that ShopkeeperID were ever reused, it would receive a different shop's
  // customer names. The reminder log is only housekeeping.
  const devicesRemoved = await pushTokens.deleteForShop(shopkeeperId)
  const remindersRemoved = await reminders.deleteForShop(shopkeeperId)
  const { default: inbox } = await import('#services/inbox')
  const notificationsRemoved = await inbox.deleteForShop(shopkeeperId)

  // The card-number counter goes too. Without it a shop registered later could
  // never reuse this ID anyway, but leaving it is a row that nothing will ever
  // read again.
  const counters = await mongodb.collection('counters').deleteMany({
    _id: { $in: [`card:${shopkeeperId}`, `cardNumber:${shopkeeperId}`] } as never,
  })

  await deletePhoto(shopkeeper.photoFile)
  await shopkeepers.collection.deleteOne({ _id: shopkeeper._id })

  return {
    cards: cardsRemoved.deletedCount,
    sessions: sessionsRemoved,
    counters: counters.deletedCount,
    photoRemoved: Boolean(shopkeeper.photoFile),
    devices: devicesRemoved,
    reminders: remindersRemoved,
    notifications: notificationsRemoved,
  }
}

/**
 * Collects keys with SCAN rather than KEYS.
 *
 * KEYS walks the whole keyspace in one blocking pass — fine on a laptop, and a
 * stall for every other client on a busy server.
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const found: string[] = []
  let cursor = '0'

  do {
    const [next, batch] = await redis.client.scan(cursor, 'MATCH', pattern, 'COUNT', 500)
    cursor = next
    found.push(...batch)
  } while (cursor !== '0')

  return found
}
