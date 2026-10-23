import vine from '@vinejs/vine'

/**
 * Registering a device for push.
 *
 * The ShopkeeperID is absent on purpose — it comes from the session. A client
 * that could name the shop could point its own browser at somebody else's
 * register and receive their customers' names.
 */
export const registerDeviceValidator = vine.create({
  /**
   * The FCM registration token.
   *
   * Only bounded in length, not pattern-matched. Its format is Firebase's to
   * define and has changed before; a regex here would start rejecting valid
   * tokens the day they lengthen one. The upper bound is there so the field
   * cannot be used to write megabytes into the collection.
   */
  token: vine.string().trim().minLength(20).maxLength(4096),

  /**
   * Which kind of client this is. Only 'web' is issued today; the other two are
   * accepted so a Capacitor build can register through this same endpoint
   * without a schema change.
   */
  platform: vine.enum(['web', 'android', 'ios'] as const).optional(),
})

/** Revoking one device. The token identifies which. */
export const revokeDeviceValidator = vine.create({
  token: vine.string().trim().minLength(20).maxLength(4096),
})

/**
 * Saving notification settings.
 *
 * Every field is optional: the settings page sends the one toggle that changed,
 * and anything absent keeps its stored value.
 */
export const notificationPreferencesValidator = vine.create({
  push: vine.boolean().optional(),
  email: vine.boolean().optional(),

  /**
   * How many days ahead to be reminded.
   *
   * Bounded at 30 because beyond about a month a "due soon" reminder stops
   * being a prompt to act and becomes a list of everything on the books — which
   * is the dashboard's job, not a notification's. Nullable so a shop can hand
   * the choice back to the server default.
   */
  leadDays: vine.number().min(1).max(30).nullable().optional(),
})
