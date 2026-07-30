import sessions from '#services/sessions'
import shopkeepers, { type ShopkeeperDocument } from '#services/shopkeepers'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Guards the routes that belong to a signed-in shop.
 *
 * The session token arrives as `Authorization: Bearer <token>`; the session
 * itself lives in Redis and the shop is read from MongoDB, so a shop whose
 * details changed — or which was removed — is reflected immediately rather
 * than being frozen into the session at sign-in.
 *
 * The resolved shop is put on the context as `ctx.shopkeeper`. Every route
 * behind this middleware should scope its data by `shopkeeper.shopkeeperId`:
 * that is the only thing keeping one shop's cards out of another's.
 */
export default class ShopkeeperAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const token = extractBearerToken(ctx.request.header('authorization'))

    if (!token) {
      return ctx.response.unauthorized({ message: 'Sign in to continue' })
    }

    const session = await sessions.find(token)
    if (!session) {
      return ctx.response.unauthorized({ message: 'Your session has ended. Sign in again.' })
    }

    const shopkeeper = await shopkeepers.findByShopkeeperId(session.shopkeeperId)
    if (!shopkeeper) {
      // The session outlived the shop it belonged to. Nothing can be done with
      // it, so drop it rather than leaving a key that can never resolve —
      // sessions have no expiry to clean it up later.
      await sessions.destroy(token)
      return ctx.response.unauthorized({ message: 'Your session has ended. Sign in again.' })
    }

    ctx.shopkeeper = shopkeeper
    ctx.sessionToken = token

    return next()
  }
}

/** Pulls the token out of `Bearer <token>`, tolerating any casing and spacing. */
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null

  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    /** The signed-in shop. Only set on routes behind this middleware. */
    shopkeeper: ShopkeeperDocument
    /** The token the request arrived with — what signing out has to destroy. */
    sessionToken: string
  }
}
