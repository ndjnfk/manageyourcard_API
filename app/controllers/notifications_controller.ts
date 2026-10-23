import inbox from '#services/inbox'
import mailer from '#services/mailer'
import push from '#services/push'
import pushTokens from '#services/push_tokens'
import reminders from '#services/reminders'
import shopkeepers from '#services/shopkeepers'
import {
  notificationPreferencesValidator,
  registerDeviceValidator,
  revokeDeviceValidator,
} from '#validators/notification'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * A shop's own notification settings and registered devices.
 *
 * Like the profile controller, nothing here takes a shop identifier: every
 * action works on `ctx.shopkeeper`, the shop the session resolved. A device
 * token is enough to receive a shop's customer names in a notification, so
 * which shop a token is filed under can never be something the request states.
 */
export default class NotificationsController {
  /**
   * The settings page's state: the preferences, the devices, and whether the
   * server can actually send on each channel.
   *
   * The `available` flags matter for the UI. Without them the page would offer
   * a push toggle on an install with no Firebase credentials, and switching it
   * on would appear to work and then never deliver anything — which reads as a
   * broken app rather than an unconfigured one.
   */
  async show({ shopkeeper, response }: HttpContext) {
    const devices = await pushTokens.forShop(shopkeeper.shopkeeperId)

    return response.ok({
      data: {
        preferences: shopkeepers.toPublic(shopkeeper).notifications,
        devices: devices.map((device) => pushTokens.toPublic(device)),
        available: {
          push: push.isConfigured,
          email: mailer.isConfigured,
        },
        /** What the reminder window resolves to for this shop, in days. */
        leadDays: reminders.leadDaysFor(shopkeeper),
      },
    })
  }

  /** Saves the settings. */
  async update({ shopkeeper, request, response }: HttpContext) {
    const payload = await request.validateUsing(notificationPreferencesValidator)

    const updated = await shopkeepers.updateNotifications(shopkeeper.shopkeeperId, payload)

    if (!updated) {
      return response.notFound({ message: 'That shop no longer exists' })
    }

    // Turning push off drops the devices as well as the flag. Keeping the
    // tokens would leave the browser subscribed to a service that has simply
    // been told not to use them — one bug away from notifications resuming for
    // someone who switched them off. Off should mean the address is gone.
    if (payload.push === false) {
      await pushTokens.revokeAll(shopkeeper.shopkeeperId)
    }

    return response.ok({ data: shopkeepers.toPublic(updated).notifications })
  }

  /**
   * Registers this browser to receive push for the signed-in shop.
   *
   * Called after the browser grants notification permission, and again on every
   * sign-in — FCM tokens rotate, and a token that changed without being
   * re-registered is a device that silently stops being notified.
   */
  async registerDevice({ shopkeeper, request, response }: HttpContext) {
    const payload = await request.validateUsing(registerDeviceValidator)

    await pushTokens.register(
      shopkeeper.shopkeeperId,
      payload.token,
      payload.platform ?? 'web',
      request.header('user-agent') ?? null
    )

    // Registering a device is a statement of intent. A shopkeeper who went
    // through the browser's permission prompt has asked for push, and leaving
    // the preference off would mean nothing arrives and nothing says why.
    if (!shopkeeper.notifications?.push) {
      await shopkeepers.updateNotifications(shopkeeper.shopkeeperId, { push: true })
    }

    return response.ok({ data: { registered: true } })
  }

  /** Stops push to one device — the one whose token is sent. */
  async revokeDevice({ shopkeeper, request, response }: HttpContext) {
    const payload = await request.validateUsing(revokeDeviceValidator)

    const revoked = await pushTokens.revoke(shopkeeper.shopkeeperId, payload.token)

    // A token that was not found is not an error worth reporting: the caller
    // wanted this device to stop receiving push, and it is not receiving push.
    // Reporting 404 would make an unregister-after-sign-out fail noisily for no
    // reason a user could act on.
    return response.ok({ data: { revoked } })
  }

  /**
   * The shop's notification list — what the bell in the app bar opens.
   *
   * The list is refreshed against what is actually due before it is read. That
   * is what makes the page useful on a fresh install: without it, nothing
   * appears until the nightly sweep has run at least once, so a shop with three
   * overdue cards would open the bell and be told there is nothing. `syncInbox`
   * is claimed once a day, so this cannot post a duplicate however often the
   * page is opened.
   */
  async inbox({ shopkeeper, response }: HttpContext) {
    await reminders.syncInbox(shopkeeper)

    const [notifications, unread] = await Promise.all([
      inbox.listForShop(shopkeeper.shopkeeperId),
      inbox.unreadCount(shopkeeper.shopkeeperId),
    ])

    return response.ok({
      data: {
        notifications: notifications.map((entry) => inbox.toPublic(entry)),
        unread,
      },
    })
  }

  /**
   * The unread count on its own — what the bell's badge needs.
   *
   * Split from `inbox` so the app bar can poll a count without pulling every
   * notification body on every page it is drawn on. It deliberately does *not*
   * sync: the badge is drawn constantly, and refreshing the list from a render
   * is how a page ends up writing to the database every few seconds.
   */
  async unreadCount({ shopkeeper, response }: HttpContext) {
    return response.ok({
      data: { unread: await inbox.unreadCount(shopkeeper.shopkeeperId) },
    })
  }

  /** Marks one notification read. */
  async markRead({ shopkeeper, params, response }: HttpContext) {
    const changed = await inbox.markRead(shopkeeper.shopkeeperId, String(params.id))

    return response.ok({
      data: { changed, unread: await inbox.unreadCount(shopkeeper.shopkeeperId) },
    })
  }

  /** Marks everything read — the "mark all as read" action on the page. */
  async markAllRead({ shopkeeper, response }: HttpContext) {
    const changed = await inbox.markAllRead(shopkeeper.shopkeeperId)

    return response.ok({ data: { changed, unread: 0 } })
  }

  /**
   * Sends this shop its reminder right now, ignoring today's send log.
   *
   * The "did I set this up correctly?" button. Deliberately the real reminder
   * rather than a canned "test" message: what a shopkeeper needs to know is
   * that a real reminder will arrive and be readable, and a message that says
   * "this is a test" proves the delivery but not the content.
   */
  async test({ shopkeeper, response }: HttpContext) {
    const digest = await reminders.buildDigest(shopkeeper)

    if (!digest) {
      return response.ok({
        data: {
          sent: false,
          reason: 'nothing-due',
          message: 'Nothing is due right now, so there is no reminder to send.',
        },
      })
    }

    const outcome = await reminders.remindShop(shopkeeper, true)

    return response.ok({
      data: {
        sent: outcome.push === 'sent' || outcome.email === 'sent',
        cards: outcome.cards,
        push: outcome.push,
        email: outcome.email,
      },
    })
  }
}
