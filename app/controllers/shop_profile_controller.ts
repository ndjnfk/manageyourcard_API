import {
  ALLOWED_EXTENSIONS,
  MAX_PHOTO_SIZE,
  deletePhoto,
  photoPathFor,
  storePhoto,
} from '#services/photo_storage'
import shopkeepers, { DuplicateShopkeeperError } from '#services/shopkeepers'
import { updateProfileValidator } from '#validators/shopkeeper'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The signed-in shop's own profile: the name it trades under, the owner's
 * name, the mobile number and the profile photo.
 *
 * Everything here works on `ctx.shopkeeper` — the shop the session resolved.
 * No route takes a shop identifier, so there is nothing to tamper with to
 * reach somebody else's profile.
 */
export default class ShopProfileController {
  /** The current profile. */
  async show({ shopkeeper, response }: HttpContext) {
    return response.ok({ data: shopkeepers.toPublic(shopkeeper) })
  }

  /** Saves the editable details. */
  async update({ shopkeeper, request, response }: HttpContext) {
    const payload = await request.validateUsing(updateProfileValidator, {
      // The validator needs to know who is saving, so it can allow this shop
      // to keep its own mobile number without reporting it as taken.
      meta: { shopkeeperId: shopkeeper.shopkeeperId },
    })

    try {
      const updated = await shopkeepers.updateProfile(shopkeeper.shopkeeperId, payload)

      if (!updated) {
        return response.notFound({ message: 'That shop no longer exists' })
      }

      return response.ok({ data: shopkeepers.toPublic(updated) })
    } catch (error) {
      if (error instanceof DuplicateShopkeeperError) {
        return response.conflict({
          errors: [{ field: error.field, rule: 'unique', message: error.message }],
        })
      }
      throw error
    }
  }

  /**
   * Replaces the profile photo.
   *
   * The type and size are enforced by the validator on the file itself rather
   * than by trusting the Content-Type the browser sent, which anything can
   * set. The previous file is deleted only once the new one is safely stored
   * and recorded — losing the old photo because the new one failed to save
   * would leave the shop with neither.
   */
  async uploadPhoto({ shopkeeper, request, response }: HttpContext) {
    const photo = request.file('photo', {
      size: MAX_PHOTO_SIZE,
      extnames: [...ALLOWED_EXTENSIONS],
    })

    if (!photo) {
      return response.unprocessableEntity({
        errors: [{ field: 'photo', rule: 'required', message: 'Choose a photo to upload' }],
      })
    }

    if (!photo.isValid) {
      return response.unprocessableEntity({
        errors: photo.errors.map((error) => ({
          field: 'photo',
          rule: error.type,
          message:
            error.type === 'size'
              ? `That image is too large. The limit is ${MAX_PHOTO_SIZE}.`
              : `That file type isn't supported. Use a ${ALLOWED_EXTENSIONS.join(', ')} image.`,
        })),
      })
    }

    const filename = await storePhoto(photo)
    const previous = await shopkeepers.setPhoto(shopkeeper.shopkeeperId, filename)
    await deletePhoto(previous)

    const updated = await shopkeepers.findByShopkeeperId(shopkeeper.shopkeeperId)

    return response.ok({ data: shopkeepers.toPublic(updated!) })
  }

  /** Removes the profile photo, falling back to the owner's initials. */
  async removePhoto({ shopkeeper, response }: HttpContext) {
    const previous = await shopkeepers.setPhoto(shopkeeper.shopkeeperId, null)
    await deletePhoto(previous)

    const updated = await shopkeepers.findByShopkeeperId(shopkeeper.shopkeeperId)

    return response.ok({ data: shopkeepers.toPublic(updated!) })
  }

  /**
   * Serves a photo file.
   *
   * Deliberately unauthenticated: an <img src> cannot send an Authorization
   * header, so requiring one would mean no photo ever renders. What stands in
   * for authentication is the filename — 32 random hex characters, which is
   * not guessable. `photoPathFor` returns null for anything that doesn't match
   * that exact shape, which is also what makes path traversal impossible.
   */
  async servePhoto({ params, response }: HttpContext) {
    const path = photoPathFor(String(params.file))

    if (!path) {
      return response.notFound({ message: 'No such photo' })
    }

    return response.download(path)
  }
}
