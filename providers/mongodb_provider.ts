import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Owns the MongoDB connection's lifecycle: opened before the server starts
 * accepting requests, closed when the process is shutting down.
 *
 * Connecting here rather than on first use means a misconfigured MONGO_URI or
 * a stopped mongod stops the boot with a clear error, instead of surfacing as
 * a failed registration later on.
 */
export default class MongodbProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    const { default: mongodb } = await import('#services/mongodb')
    const { default: shopkeepers } = await import('#services/shopkeepers')
    const { default: cards } = await import('#services/cards')
    const { default: admins } = await import('#services/admin/admins')
    const { default: pushTokens } = await import('#services/push_tokens')
    const { default: reminders } = await import('#services/reminders')
    const { default: inbox } = await import('#services/inbox')
    const { default: logger } = await import('@adonisjs/core/services/logger')

    await mongodb.connect()

    // Uniqueness for email, mobile and shopkeeperId is enforced by indexes, so
    // they have to exist before the first registration is accepted. The same
    // goes for card numbers, which are unique within a shop.
    await shopkeepers.createIndexes()
    await cards.createIndexes()
    await admins.createIndexes()
    // A push token is unique per device, and a reminder is unique per shop per
    // channel per day. Both are enforced by indexes rather than by checking
    // first — the reminder one in particular is the only thing stopping two
    // overlapping cron runs from sending everything twice.
    await pushTokens.createIndexes()
    await reminders.createIndexes()
    await inbox.createIndexes()

    logger.info('MongoDB connected')
  }

  async shutdown() {
    const { default: mongodb } = await import('#services/mongodb')
    await mongodb.close()
  }
}
