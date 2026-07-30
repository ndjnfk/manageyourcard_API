import sessions from '#services/sessions'
import shopkeepers from '#services/shopkeepers'
import { loginValidator } from '#validators/shopkeeper'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Signing in, staying signed in, and signing out.
 *
 * A session is a random token held in Redis with no expiry: once a shop signs
 * in it stays signed in until it signs out, across browser restarts and for as
 * long as Redis keeps the key. `destroy` is the only thing that ends one.
 */
export default class SessionsController {
  /**
   * Sign in. Returns the session token the client stores, plus the shop, so
   * the dashboard can be drawn without a second round trip.
   */
  async store({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const shopkeeper = await shopkeepers.verifyCredentials(email, password)

    if (!shopkeeper) {
      // One message for both the unknown email and the wrong password. Saying
      // which was wrong tells anyone with a list of addresses which of them
      // have shops here.
      return response.unauthorized({
        message: 'That email and password don’t match a shop.',
      })
    }

    const token = await sessions.create(shopkeeper.shopkeeperId)

    return response.ok({
      data: {
        token,
        shopkeeper: shopkeepers.toPublic(shopkeeper),
      },
    })
  }

  /**
   * The shop behind the token the request arrived with.
   *
   * This is what the app calls on startup: a token that still resolves means
   * the shopkeeper is still signed in and should land on their dashboard
   * rather than the landing page. A 401 from here means the reverse.
   */
  async show({ shopkeeper, response }: HttpContext) {
    return response.ok({
      data: { shopkeeper: shopkeepers.toPublic(shopkeeper) },
    })
  }

  /**
   * Sign out — the one thing that removes the session key from Redis.
   *
   * Only the token the request carries is destroyed, so signing out on the
   * counter phone does not sign the shop out on the desk computer.
   */
  async destroy({ sessionToken, response }: HttpContext) {
    await sessions.destroy(sessionToken)

    return response.noContent()
  }
}
