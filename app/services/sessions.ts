import redis from '#services/redis'
import { createHash, randomBytes } from 'node:crypto'

/** Namespace for the session keys, so they are recognisable in a Redis dump. */
const KEY_PREFIX = 'myc:session:'

/**
 * Per-shopkeeper index of their live sessions. Without it, a shop signed in on
 * five devices has five keys that nothing can enumerate — and since sessions
 * never expire on their own, nothing would ever clean them up either.
 */
const INDEX_PREFIX = 'myc:sessions:'

/** What a session holds. The shop itself is read from MongoDB, so it can't go stale here. */
export interface SessionRecord {
  shopkeeperId: string
  createdAt: string
}

/**
 * Signed-in sessions, kept in Redis.
 *
 * These are stored **without an expiry**, on purpose: a shopkeeper stays signed
 * in until they sign out themselves. Nothing here may set a TTL — that is the
 * whole contract of this file. It also means Redis holds durable state rather
 * than a cache: flushing it signs everybody out.
 */
class Sessions {
  /**
   * Redis is keyed by a hash of the token, never the token itself. The token is
   * a bearer credential — anyone holding one is signed in — so a dump of Redis
   * should not hand out working credentials. Hashing is one-way, and since the
   * token is high-entropy random rather than a password, a plain SHA-256 is
   * enough: there is nothing to brute-force.
   */
  #key(token: string): string {
    return KEY_PREFIX + createHash('sha256').update(token).digest('hex')
  }

  #indexKey(shopkeeperId: string): string {
    return INDEX_PREFIX + shopkeeperId
  }

  /**
   * Opens a session and returns the token to hand back to the client. The token
   * is only ever readable here and at the client — the server keeps its hash.
   */
  async create(shopkeeperId: string): Promise<string> {
    // 32 random bytes: far past guessing, and base64url keeps it safe to put in
    // a header or a URL without escaping.
    const token = randomBytes(32).toString('base64url')
    const record: SessionRecord = {
      shopkeeperId,
      createdAt: new Date().toISOString(),
    }

    const key = this.#key(token)
    // SET with no EX/PX argument stores the value with no expiry. This is the
    // "stays signed in until they sign out" requirement — do not add one.
    await redis.client
      .multi()
      .set(key, JSON.stringify(record))
      .sadd(this.#indexKey(shopkeeperId), key)
      .exec()

    return token
  }

  /** Returns the session a token belongs to, or null if there is no such session. */
  async find(token: string): Promise<SessionRecord | null> {
    const raw = await redis.client.get(this.#key(token))
    if (!raw) return null

    try {
      return JSON.parse(raw) as SessionRecord
    } catch {
      // Unreadable value — treat it as no session rather than a 500, and drop
      // it so it cannot keep failing.
      await redis.client.del(this.#key(token))
      return null
    }
  }

  /**
   * Ends every session belonging to one shop, and drops their index.
   *
   * Used when a shop is deleted. Their sessions have no expiry, so leaving
   * them would be keys that can never resolve and will never be cleaned up —
   * and a token that still names a shop the middleware can no longer find.
   */
  async destroyAllFor(shopkeeperId: string): Promise<number> {
    const indexKey = this.#indexKey(shopkeeperId)
    const keys = await redis.client.smembers(indexKey)

    const removed = keys.length > 0 ? await redis.client.del(...keys) : 0
    await redis.client.del(indexKey)

    return removed
  }

  /**
   * Ends one session. This is the only thing that removes a session key, which
   * is what makes signing out the sole way to become signed out.
   */
  async destroy(token: string): Promise<void> {
    const key = this.#key(token)
    const record = await this.find(token)

    const pipeline = redis.client.multi().del(key)
    if (record) {
      pipeline.srem(this.#indexKey(record.shopkeeperId), key)
    }

    await pipeline.exec()
  }
}

export default new Sessions()
