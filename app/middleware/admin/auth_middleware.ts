import adminSessions from '#services/admin/sessions'
import admins, { type AdminDocument } from '#services/admin/admins'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Guards every admin route.
 *
 * The token arrives as `Authorization: Bearer <token>`, the session lives in
 * Redis with a seven-day expiry, and the admin is read from MongoDB — so an
 * admin whose record was removed stops having access immediately rather than
 * being frozen into the session at sign-in.
 *
 * This is a separate middleware from the shopkeepers' on purpose. A shared one
 * with a role flag is one wrong branch away from a shop reaching admin routes;
 * two middlewares reading two different Redis namespaces cannot make that
 * mistake.
 */
export default class AdminAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const token = extractBearerToken(ctx.request.header('authorization'))

    if (!token) {
      return ctx.response.unauthorized({ message: 'Sign in to continue' })
    }

    const session = await adminSessions.find(token)
    if (!session) {
      return ctx.response.unauthorized({ message: 'Your session has ended. Sign in again.' })
    }

    const admin = await admins.findByEmail(session.email)
    if (!admin) {
      // The session outlived the admin it belonged to. Nothing can be done
      // with it, so drop it rather than leaving a key that never resolves.
      await adminSessions.destroy(token)
      return ctx.response.unauthorized({ message: 'Your session has ended. Sign in again.' })
    }

    ctx.admin = admin
    ctx.adminToken = token

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
    /** The signed-in admin. Only set on routes behind this middleware. */
    admin: AdminDocument
    /** The token the request arrived with — what signing out has to destroy. */
    adminToken: string
  }
}
