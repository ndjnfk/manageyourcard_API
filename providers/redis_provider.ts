import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Owns the Redis connection's lifecycle.
 *
 * Redis holds the signed-in sessions, and they are stored without an expiry —
 * so this is durable state, not a cache. A Redis that isn't running has to stop
 * the boot rather than surface later as every shopkeeper being signed out.
 */
export default class RedisProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    const { default: redis } = await import('#services/redis')
    const { default: logger } = await import('@adonisjs/core/services/logger')

    await redis.connect()

    logger.info('Redis connected')
  }

  async shutdown() {
    const { default: redis } = await import('#services/redis')
    await redis.close()
  }
}
