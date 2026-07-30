import shopkeepers from '#services/shopkeepers'
import vine from '@vinejs/vine'

/**
 * An admin editing a shop.
 *
 * Wider than the shop's own profile form — an admin may change the email and
 * reset the password, which a shopkeeper cannot do from their profile. What is
 * still absent is the ShopkeeperID: it is the key every card is filed under,
 * and changing it would orphan the whole register.
 *
 * Uniqueness on the email and mobile excludes the shop being edited, via
 * `meta.shopkeeperId` — without it, saving a form without touching either
 * would collide with the shop's own record and report it as taken.
 */
export const adminUpdateShopkeeperValidator = vine.create({
  shopName: vine.string().trim().minLength(2).maxLength(80).optional(),

  ownerName: vine.string().trim().minLength(2).maxLength(60).optional(),

  mobile: vine
    .string()
    .parse((value) =>
      typeof value === 'string' ? shopkeepers.normaliseMobile(value.trim()) : value
    )
    .regex(/^[6-9]\d{9}$/)
    .use(
      vine.createRule(
        async (value: unknown, _options: undefined, field) => {
          if (typeof value !== 'string') return

          const owner = await shopkeepers.findByMobile(value)
          if (owner && owner.shopkeeperId !== field.meta?.shopkeeperId) {
            field.report('Another shop is already using this mobile number', 'unique', field)
          }
        },
        { name: 'adminUniqueMobile', isAsync: true }
      )()
    )
    .optional(),

  email: vine
    .string()
    .parse((value) => (typeof value === 'string' ? shopkeepers.normaliseEmail(value) : value))
    .email()
    .maxLength(120)
    .use(
      vine.createRule(
        async (value: unknown, _options: undefined, field) => {
          if (typeof value !== 'string') return

          const owner = await shopkeepers.findByEmail(value)
          if (owner && owner.shopkeeperId !== field.meta?.shopkeeperId) {
            field.report('Another shop is already using this email address', 'unique', field)
          }
        },
        { name: 'adminUniqueEmail', isAsync: true }
      )()
    )
    .optional(),

  /**
   * Resets the shop's password. Absent means "leave it" — the hash is never
   * sent to the client, so there is nothing to round-trip.
   */
  password: vine.string().minLength(8).maxLength(64).regex(/[A-Za-z]/).regex(/\d/).optional(),
})

/**
 * Deleting a shop.
 *
 * `confirm` has to be the shop's own ShopkeeperID, checked against the one in
 * the URL by the controller. A fixed word like CONFIRM would guard against a
 * stray click but not against deleting the wrong shop — and with a table of
 * them a row apart, that is the mistake worth designing against.
 */
export const adminDeleteShopkeeperValidator = vine.create({
  confirm: vine.string().trim(),
})
