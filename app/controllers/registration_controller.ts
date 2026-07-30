import shopkeepers, { DuplicateShopkeeperError } from '#services/shopkeepers'
import { registerShopkeeperValidator } from '#validators/shopkeeper'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Shop registration — creates the Shopkeeper record every card is later filed
 * under, in the `users` collection.
 *
 * The ShopkeeperID is assigned here rather than accepted from the request:
 * it is the key the whole app isolates data by, so a client that could choose
 * one could file cards into another shop's register.
 */
export default class RegistrationController {
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(registerShopkeeperValidator)

    let shopkeeper
    try {
      shopkeeper = await shopkeepers.register(payload)
    } catch (error) {
      // The validator already checked these, so reaching here means another
      // registration won the race in between. It is the same mistake from the
      // shopkeeper's point of view, so it is reported in the same shape the
      // validator uses — one mapping path on the form for both.
      if (error instanceof DuplicateShopkeeperError) {
        return response.conflict({
          errors: [{ field: error.field, rule: 'unique', message: error.message }],
        })
      }
      throw error
    }

    // toPublic is what keeps the password out of this response — it is
    // write-only from the moment it arrives. Registering does not sign the
    // shop in: they choose a password here and then use it to sign in, which
    // is also the first check that they remember what they chose.
    return response.created({ data: shopkeepers.toPublic(shopkeeper) })
  }
}
