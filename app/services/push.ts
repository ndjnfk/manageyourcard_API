import pushTokens, { type PushTokenDocument } from '#services/push_tokens'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { type App, cert, initializeApp } from 'firebase-admin/app'
import { type Message, getMessaging } from 'firebase-admin/messaging'

/**
 * What a notification says and where tapping it goes.
 *
 * `url` is a path inside the app rather than an absolute URL — the app's origin
 * differs between development and production, and the service worker resolves
 * it against wherever it is actually running.
 */
export interface PushPayload {
  title: string
  body: string
  /** In-app path to open, e.g. "/dashboard". Defaults to the dashboard. */
  url?: string
  /**
   * Collapses notifications that supersede each other.
   *
   * Two nights of "3 cards due this week" should leave one notification in the
   * tray, not a growing stack of stale counts — a shopkeeper who missed
   * yesterday's wants today's number, not both. Notifications sharing a tag
   * replace one another.
   */
  tag?: string
}

/** What a send actually did. Returned so callers can log it honestly. */
export interface PushResult {
  sent: number
  failed: number
  /** Tokens FCM rejected as dead, already removed from the store. */
  pruned: number
  /** Set when nothing was attempted, with the reason. */
  skipped?: 'not-configured' | 'no-devices'
}

/**
 * The FCM error codes that mean a token is gone for good.
 *
 * A token dies when the browser's push subscription is revoked — permission
 * withdrawn, site data cleared, the PWA uninstalled. Nothing about it will ever
 * work again, so it is deleted rather than retried. Every other failure (a
 * network blip, FCM being unavailable) leaves the token alone: those are
 * temporary, and deleting on one would silently unsubscribe working devices.
 */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
])

/**
 * Sends push through Firebase Cloud Messaging.
 *
 * Initialised lazily and tolerantly: an install with no Firebase credentials is
 * a normal state — the app is useful without push — so a missing service
 * account makes `isConfigured` false rather than throwing at boot. Callers get
 * a result saying nothing was sent instead of an exception, because failing to
 * notify must never fail the request that triggered it.
 */
class Push {
  #app: App | null = null
  /** Set once initialisation has been attempted, successfully or not. */
  #initialised = false

  /**
   * Whether a service account is present. Checked before every send, and
   * reported to the settings page so it can say why push is unavailable rather
   * than offering a toggle that does nothing.
   */
  get isConfigured(): boolean {
    return Boolean(
      env.get('FIREBASE_PROJECT_ID') &&
        env.get('FIREBASE_CLIENT_EMAIL') &&
        env.get('FIREBASE_PRIVATE_KEY')
    )
  }

  /**
   * The Firebase app, or null when it cannot be built.
   *
   * Created on first use rather than at boot so that the API starts without
   * Firebase configured. `#initialised` makes a failure sticky — without it a
   * malformed private key would be re-parsed and re-logged on every single
   * notification.
   */
  #firebase(): App | null {
    if (this.#initialised) return this.#app
    this.#initialised = true

    if (!this.isConfigured) return null

    try {
      this.#app = initializeApp({
        credential: cert({
          projectId: env.get('FIREBASE_PROJECT_ID'),
          clientEmail: env.get('FIREBASE_CLIENT_EMAIL'),
          // A PEM key's newlines cannot survive a .env file, so it is stored
          // with literal backslash-n and restored here. Without this the key
          // parses as a single line and every send fails on a signing error
          // that says nothing about the cause.
          privateKey: env.get('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n'),
        }),
      })
    } catch (error) {
      logger.error({ err: error }, 'Firebase could not be initialised — push is disabled')
      this.#app = null
    }

    return this.#app
  }

  /**
   * Pushes to every device registered to one shop.
   *
   * Never throws. A notification is a courtesy on top of whatever the caller
   * was doing — a card is still saved if the push fails — so problems are
   * logged and returned rather than raised.
   */
  async sendToShop(shopkeeperId: string, payload: PushPayload): Promise<PushResult> {
    const app = this.#firebase()
    if (!app) return { sent: 0, failed: 0, pruned: 0, skipped: 'not-configured' }

    const devices = await pushTokens.forShop(shopkeeperId)
    if (devices.length === 0) return { sent: 0, failed: 0, pruned: 0, skipped: 'no-devices' }

    const messages: Message[] = devices.map((device) => this.#messageFor(device, payload))

    try {
      const response = await getMessaging(app).sendEach(messages)
      const dead: string[] = []

      response.responses.forEach((result, index) => {
        if (result.success) return

        const code = result.error?.code
        // Responses come back in the order the messages went out, which is
        // what makes indexing back into `devices` sound.
        if (code && DEAD_TOKEN_CODES.has(code)) {
          dead.push(devices[index].token)
          return
        }

        logger.warn(
          { shopkeeperId, code, err: result.error?.message },
          'A push notification failed'
        )
      })

      const pruned = await pushTokens.prune(dead)

      return { sent: response.successCount, failed: response.failureCount, pruned }
    } catch (error) {
      // FCM unreachable, or credentials rejected outright. Nothing was sent and
      // no token is implicated, so nothing is pruned.
      logger.error({ err: error, shopkeeperId }, 'Could not reach Firebase Cloud Messaging')
      return { sent: 0, failed: devices.length, pruned: 0 }
    }
  }

  /**
   * Builds the message for one device, shaped for the platform it runs on.
   *
   * The web and the native app need genuinely different payloads, and sending
   * one shape to both fails in opposite directions — a web-only payload never
   * displays on Android, and the payload that makes Android work shows the
   * notification twice on the web. Hence the branch.
   *
   * `data` is identical either way, because both clients route a tap from it.
   */
  #messageFor(device: PushTokenDocument, payload: PushPayload): Message {
    /**
     * Read by both clients: the service worker's `onBackgroundMessage` on the
     * web, and `pushNotificationActionPerformed` in the native app. Every value
     * must be a string — FCM rejects a data payload containing anything else.
     */
    const data = {
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/dashboard',
      tag: payload.tag ?? 'due-reminder',
    }

    if (device.platform === 'android') {
      return {
        token: device.token,
        /**
         * A real `notification` block, unlike the web branch below.
         *
         * On Android this is what makes the system draw the notification while
         * the app is backgrounded or closed — with data alone, FCM hands the
         * message to the app and nothing appears unless the app happens to be
         * running. The double-display problem that rules this out on the web
         * does not exist here: there is no second handler competing to show it.
         */
        android: {
          notification: {
            title: payload.title,
            body: payload.body,
            // The white silhouette from res/drawable, not the launcher icon —
            // Android renders a status-bar icon from its alpha channel alone.
            icon: 'ic_stat_notify',
            // Tints that silhouette, which is the only way the brand violet
            // reaches a status bar. The web branch below has no equivalent.
            color: '#7B2FF7',
            // Must match the channel MainActivity creates. A notification on a
            // channel that does not exist is dropped without an error.
            channelId: 'due_reminders',
            // Today's reminder replaces yesterday's rather than stacking.
            tag: payload.tag ?? 'due-reminder',
          },
          // Reminders are not time-critical. 'high' would wake the device from
          // doze, which is not warranted for a card due next week — and is the
          // sort of thing that gets an app's notifications turned off.
          priority: 'normal',
        },
        data,
      }
    }

    if (device.platform === 'ios') {
      return {
        token: device.token,
        /**
         * An `aps` block, for the same reason Android needs its `notification`
         * one: with data alone iOS hands the message to the app and draws
         * nothing, so a backgrounded app shows no notification at all.
         *
         * None of this reaches a device without an **APNs authentication key**
         * uploaded to the Firebase console — FCM has no other way to talk to
         * Apple. Until that key exists every send here fails at Firebase with a
         * third-party-auth error, which is worth knowing before hunting for the
         * bug in this payload.
         */
        apns: {
          headers: {
            /**
             * The true counterpart of the web and Android `tag`: APNs replaces
             * a delivered notification carrying the same collapse id rather
             * than stacking a second one behind it.
             */
            'apns-collapse-id': payload.tag ?? 'due-reminder',
            // 5 is APNs' "normal", matching the android branch's 'normal'. 10
            // is immediate delivery, which is not what a card due next week is.
            'apns-priority': '5',
          },
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              sound: 'default',
              /**
               * Groups reminders together in Notification Centre.
               *
               * Separate from the collapse id above despite usually holding the
               * same value: collapsing decides whether an old notification is
               * *replaced*, threading decides how the ones that remain are
               * *stacked*. They answer different questions.
               */
              threadId: payload.tag ?? 'due-reminder',
            },
          },
        },
        data,
      }
    }

    return {
      token: device.token,
      /**
       * Declared under `webpush` and never at the top level.
       *
       * A top-level `notification` makes FCM's own service worker display the
       * message before ours is consulted, showing it twice on some browsers —
       * once by FCM and once by our handler. Keeping it here means
       * `onBackgroundMessage` is the single thing deciding what appears.
       */
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icons/icon-192x192.png',
          // The alpha-only silhouette, not the launcher icon — a browser masks
          // the badge to a monochrome glyph, and the full-colour square comes
          // out featureless. The service worker overrides both of these in
          // practice; they are here so the fallback path looks the same.
          badge: '/icons/badge-96x96.png',
          tag: payload.tag,
          // Renotify without a tag is meaningless to the Push API, and some
          // browsers reject the whole notification for it.
          renotify: payload.tag ? true : undefined,
        },
        fcmOptions: {
          // Where a click goes when the service worker has no better idea.
          link: this.#absoluteUrl(payload.url),
        },
      },
      data,
    }
  }

  /** Turns an in-app path into an absolute URL on the browser app's origin. */
  #absoluteUrl(path: string | undefined): string {
    const base = env.get('WEB_APP_URL').replace(/\/$/, '')
    const target = path ?? '/dashboard'

    return target.startsWith('http') ? target : `${base}${target.startsWith('/') ? '' : '/'}${target}`
  }
}

export default new Push()
