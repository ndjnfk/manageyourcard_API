import redis from '#services/redis'
import { createHash, randomBytes } from 'node:crypto'

/** Namespace for admin session keys, kept apart from the shopkeepers'. */
const KEY_PREFIX = 'myc:admin-session:'

/**
 * Seven days, in seconds.
 *
 * The opposite of a shopkeeper's session, which never expires. An admin can
 * flush every shop's data and sign every shopkeeper out, so a forgotten
 * browser session is worth far more to whoever finds it — it should stop
 * working on its own, and soon enough to matter.
 */
export const ADMIN_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

export interface AdminSessionRecord {
  email: string
  createdAt: string
}

/**
 * Signed-in admin sessions, in Redis.
 *
 * Same shape as the shopkeepers' sessions with one deliberate difference: the
 * key carries an expiry. Nothing here may drop it.
 */
class AdminSessions {
  /**
   * Redis is keyed by a hash of the token, never the token itself. The token
   * is a bearer credential, so a dump of Redis should not hand out working
   * admin access. The token is high-entropy random rather than a password, so
   * a plain SHA-256 is enough — there is nothing to brute-force.
   */
  #key(token: string): string {
    return KEY_PREFIX + createHash('sha256').update(token).digest('hex')
  }

  async create(email: string): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    const record: AdminSessionRecord = { email, createdAt: new Date().toISOString() }

    // EX is the whole point of this file — see ADMIN_SESSION_TTL_SECONDS.
    await redis.client.set(this.#key(token), JSON.stringify(record), 'EX', ADMIN_SESSION_TTL_SECONDS)

    return token
  }

  async find(token: string): Promise<AdminSessionRecord | null> {
    const raw = await redis.client.get(this.#key(token))
    if (!raw) return null

    try {
      return JSON.parse(raw) as AdminSessionRecord
    } catch {
      await redis.client.del(this.#key(token))
      return null
    }
  }

  /**
   * How long this session has left, in seconds. Negative if it has no expiry
   * or does not exist — only ever used to tell the admin where they stand.
   */
  async ttl(token: string): Promise<number> {
    return redis.client.ttl(this.#key(token))
  }

  async destroy(token: string): Promise<void> {
    await redis.client.del(this.#key(token))
  }

  /** Every live admin session key. Used to spare them from a Redis flush. */
  async keys(): Promise<string[]> {
    return redis.client.keys(`${KEY_PREFIX}*`)
  }
}

export default new AdminSessions()
