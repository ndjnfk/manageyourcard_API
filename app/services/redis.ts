import env from '#start/env'
import { Redis } from 'ioredis'

/**
 * The application's Redis connection — where signed-in sessions live.
 *
 * One client for the whole process, opened on boot by
 * `#providers/redis_provider` and closed on shutdown, for the same reasons as
 * the MongoDB client: the driver keeps its own connection, and reconnecting per
 * request would pay a handshake on every authenticated call.
 */
class RedisService {
  #client: Redis | null = null

  async connect(): Promise<void> {
    if (this.#client) return

    const password = env.get('REDIS_PASSWORD')
    const client = new Redis({
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      // An empty REDIS_PASSWORD means the server has no password set. Passing
      // '' would make ioredis send AUTH anyway, which such a server rejects.
      ...(password ? { password } : {}),
      db: env.get('REDIS_DB') ?? 0,
      // Connect eagerly on boot rather than on the first command, so a Redis
      // that isn't running is a startup failure and not a failed sign-in.
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    })

    await client.connect()
    this.#client = client
  }

  async close(): Promise<void> {
    if (!this.#client) return

    await this.#client.quit()
    this.#client = null
  }

  get client(): Redis {
    if (!this.#client) {
      throw new Error('Redis is not connected. Was the Redis provider registered?')
    }

    return this.#client
  }
}

export default new RedisService()
