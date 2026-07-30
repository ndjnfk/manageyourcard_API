import admins from '#services/admin/admins'
import vine from '@vinejs/vine'

/**
 * Admin sign-in.
 *
 * As with the shopkeepers' sign-in, no strength rules: an existing password
 * only has to match, and re-stating the policy here both annoys and advertises
 * it. The strength rule that matters is in the `admin:create` command, which
 * is the only way an admin password is ever set.
 */
export const adminLoginValidator = vine.create({
  email: vine
    .string()
    .parse((value) => (typeof value === 'string' ? admins.normaliseEmail(value) : value))
    .email()
    .maxLength(254),

  password: vine.string().maxLength(64),
})
