import cards from '#services/cards'
import { clearRedis, clearShopData, logOutAllShopkeepers } from '#services/admin/maintenance'
import shopkeepers from '#services/shopkeepers'
import { maintenanceValidator } from '#validators/admin/maintenance'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The admin dashboard's figures, and the destructive actions in its side panel.
 *
 * Every action here demands a typed confirmation — see `maintenanceValidator`.
 * They wipe every shop's data, so a misplaced click must not be enough, and
 * the guard has to hold for a request sent by hand as well as one sent by the
 * panel.
 */
export default class AdminMaintenanceController {
  /** Headline counts for the dashboard. */
  async stats({ response }: HttpContext) {
    const [shops, allCards, liveCards, completedCards] = await Promise.all([
      shopkeepers.collection.countDocuments(),
      cards.collection.countDocuments(),
      cards.collection.countDocuments({ completedAt: null }),
      cards.collection.countDocuments({ completedAt: { $ne: null } }),
    ])

    return response.ok({
      data: { shopkeepers: shops, cards: allCards, liveCards, completedCards },
    })
  }

  /**
   * Signs every shopkeeper out.
   *
   * A shopkeeper's session never expires on its own, so this and their own
   * sign-out are the only two things that end one.
   */
  async logOutShopkeepers({ request, response }: HttpContext) {
    await request.validateUsing(maintenanceValidator)

    const removed = await logOutAllShopkeepers()

    return response.ok({
      data: { removed, message: `Signed out ${removed === 0 ? 'nobody' : `${removed} session(s)`}` },
    })
  }

  /**
   * Empties Redis, sparing the admin sessions.
   *
   * Sparing them is not a nicety: flushing everything would delete the key
   * this request authenticated with, signing the admin out by their own
   * action — unable to see whether it worked, and likely to run it twice.
   */
  async clearRedis({ request, response }: HttpContext) {
    await request.validateUsing(maintenanceValidator)

    const removed = await clearRedis()

    return response.ok({
      data: { removed, message: `Removed ${removed} key(s). Admin sessions were kept.` },
    })
  }

  /** Drops every shop collection. `admins` is deliberately left alone. */
  async clearData({ request, response }: HttpContext) {
    await request.validateUsing(maintenanceValidator)

    const removed = await clearShopData()
    const total = Object.values(removed).reduce((sum, count) => sum + count, 0)

    return response.ok({
      data: {
        removed,
        message: `Removed ${total} document(s) across ${Object.keys(removed).join(', ')}. Admins were kept.`,
      },
    })
  }
}
