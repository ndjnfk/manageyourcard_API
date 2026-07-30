import adminSessions, { ADMIN_SESSION_TTL_SECONDS } from '#services/admin/sessions'
import admins from '#services/admin/admins'
import { adminLoginValidator } from '#validators/admin/auth'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Admin sign-in, session and sign-out.
 *
 * Unlike a shopkeeper's session, an admin's expires on its own after seven
 * days — an admin can wipe every shop's data, so a forgotten browser session
 * is worth far more to whoever finds it.
 */
export default class AdminAuthController {
  async store({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(adminLoginValidator)

    const admin = await admins.verifyCredentials(email, password)

    if (!admin) {
      // One message for both the unknown email and the wrong password: saying
      // which was wrong would confirm that an address is an admin account.
      return response.unauthorized({ message: 'That email and password don’t match an admin.' })
    }

    const token = await adminSessions.create(admin.email)

    return response.ok({
      data: {
        token,
        admin: admins.toPublic(admin),
        expiresInSeconds: ADMIN_SESSION_TTL_SECONDS,
      },
    })
  }

  /**
   * The admin behind the token, and how long the session has left.
   *
   * The app calls this on startup to decide between the panel and the sign-in
   * page. The remaining time is returned so it can warn before a session that
   * expires on its own actually does.
   */
  async show({ admin, adminToken, response }: HttpContext) {
    return response.ok({
      data: {
        admin: admins.toPublic(admin),
        expiresInSeconds: await adminSessions.ttl(adminToken),
      },
    })
  }

  /** Signs out. Only this session — not every admin's. */
  async destroy({ adminToken, response }: HttpContext) {
    await adminSessions.destroy(adminToken)

    return response.noContent()
  }
}
