import shopkeepers from '#services/shopkeepers'
import vine from '@vinejs/vine'

/**
 * Rejects an email that is already registered.
 *
 * This is a courtesy, not the guarantee: two registrations submitted at the
 * same moment can both pass this check and both proceed. The unique index on
 * the collection is what actually prevents the second insert — see
 * `Shopkeepers.register`.
 */
const uniqueEmail = vine.createRule(
  async (value: unknown, _options: undefined, field) => {
    if (typeof value !== 'string') return

    if (await shopkeepers.findByEmail(value)) {
      field.report('A shop is already registered with this email address', 'unique', field)
    }
  },
  { name: 'uniqueEmail', isAsync: true }
)

/** The same courtesy check for the mobile number. */
const uniqueMobile = vine.createRule(
  async (value: unknown, _options: undefined, field) => {
    if (typeof value !== 'string') return

    if (await shopkeepers.findByMobile(value)) {
      field.report('A shop is already registered with this mobile number', 'unique', field)
    }
  },
  { name: 'uniqueMobile', isAsync: true }
)

/**
 * Registration rules for a shop.
 *
 * These deliberately mirror `src/app/shared/validators.ts` in the GUI. The
 * browser copy exists to give immediate feedback; this one is the rule, because
 * anything can post to the API. Where the two must agree — what a valid mobile
 * number is, what a password must contain — changing one means changing both.
 *
 * ShopkeeperID is absent on purpose: it is the primary key and is assigned when
 * the record is created, so accepting one from the client would let a shop
 * claim another shop's ID.
 */
export const registerShopkeeperValidator = vine.create({
  shopName: vine.string().trim().minLength(2).maxLength(80),

  ownerName: vine.string().trim().minLength(2).maxLength(60),

  /**
   * Ten digits starting 6–9, written however the shopkeeper likes: "+91 98765
   * 43210" and "9876543210" are the same number. `parse` runs before the
   * rules, so normalising there is what makes both spellings pass the regex —
   * and what stops one number registering twice under two spellings, since
   * the uniqueness check then sees the same ten digits either way.
   */
  mobile: vine
    .string()
    .parse((value) => (typeof value === 'string' ? shopkeepers.normaliseMobile(value.trim()) : value))
    .regex(/^[6-9]\d{9}$/)
    .use(uniqueMobile()),

  email: vine
    .string()
    .parse((value) => (typeof value === 'string' ? shopkeepers.normaliseEmail(value) : value))
    .email()
    .maxLength(120)
    .use(uniqueEmail()),

  /**
   * Long enough to be worth having and mixed enough not to be a dictionary
   * word — rules a shopkeeper can satisfy at the counter. Anything stricter
   * only pushes them towards writing the password on the register.
   */
  password: vine.string().minLength(8).maxLength(64).regex(/[A-Za-z]/).regex(/\d/),
})

/**
 * Editing a shop's own profile.
 *
 * Every field is optional — a save sends only what changed. The email, the
 * password and the ShopkeeperID are all absent: the first two are account
 * security matters that want their own flow, and the third is the key every
 * card is filed under, so changing it would orphan the whole register.
 *
 * The mobile's uniqueness is checked against every *other* shop. Without the
 * exclusion, saving a profile without touching the number would collide with
 * the shop's own record and report the number as taken.
 */
export const updateProfileValidator = vine.create({
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
          // `meta.shopkeeperId` is the shop doing the saving — passed in by the
          // controller, because a validator has no session of its own.
          if (owner && owner.shopkeeperId !== field.meta?.shopkeeperId) {
            field.report('Another shop is already using this mobile number', 'unique', field)
          }
        },
        { name: 'uniqueMobileExceptSelf', isAsync: true }
      )()
    )
    .optional(),
})

/**
 * Sign-in rules.
 *
 * Deliberately weaker than registration's: an existing password only has to
 * match. Re-stating the strength policy here would reject a shop whose password
 * predates the policy, and it would advertise the policy to anyone guessing.
 * The email is still normalised, so it is looked up the way it was stored.
 */
export const loginValidator = vine.create({
  email: vine
    .string()
    .parse((value) => (typeof value === 'string' ? shopkeepers.normaliseEmail(value) : value))
    .email()
    .maxLength(120),

  password: vine.string().maxLength(64),
})
