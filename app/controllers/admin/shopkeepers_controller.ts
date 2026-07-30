import { deleteShop } from '#services/admin/maintenance'
import cards from '#services/cards'
import shopkeepers, { DuplicateShopkeeperError } from '#services/shopkeepers'
import {
  adminDeleteShopkeeperValidator,
  adminUpdateShopkeeperValidator,
} from '#validators/admin/shopkeeper'
import type { HttpContext } from '@adonisjs/core/http'

const DEFAULT_PER_PAGE = 12

/**
 * Every shop, and every shop's cards, from the admin panel.
 *
 * This is the one place in the app where a query is *not* scoped to one shop.
 * That is the whole point of an admin panel, and it is exactly why these
 * routes sit behind their own middleware and their own Redis namespace rather
 * than a role flag on a shopkeeper session.
 */
export default class AdminShopkeepersController {
  /** All shops, searchable and paged. */
  async index({ request, response }: HttpContext) {
    const page = readPage(request.input('page'))
    const perPage = readPerPage(request.input('perPage'))

    const result = await shopkeepers.search({
      search: request.input('search'),
      page,
      perPage,
    })

    return response.ok({
      data: result.shopkeepers.map((shopkeeper) => shopkeepers.toPublic(shopkeeper)),
      meta: {
        page,
        perPage,
        total: result.total,
        lastPage: Math.max(1, Math.ceil(result.total / perPage)),
      },
    })
  }

  /** One shop, with a count of what it holds. */
  async show({ params, response }: HttpContext) {
    const shopkeeper = await shopkeepers.findByShopkeeperId(params.shopkeeperId)

    if (!shopkeeper) {
      return response.notFound({ message: 'No such shop' })
    }

    return response.ok({ data: shopkeepers.toPublic(shopkeeper) })
  }

  /**
   * Edits a shop — including its email and password, which the shop itself
   * cannot change from its own profile.
   */
  async update({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(adminUpdateShopkeeperValidator, {
      meta: { shopkeeperId: params.shopkeeperId },
    })

    try {
      const updated = await shopkeepers.adminUpdate(params.shopkeeperId, payload)

      if (!updated) {
        return response.notFound({ message: 'No such shop' })
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
   * Deletes a shop and everything belonging to it — its cards, its sessions,
   * its counters and its photo.
   *
   * The body must carry the shop's own ShopkeeperID as `confirm`. A fixed word
   * would guard against a stray click but not against deleting the wrong shop,
   * which with a table of them a row apart is the mistake that matters.
   */
  async destroy({ params, request, response }: HttpContext) {
    const { confirm } = await request.validateUsing(adminDeleteShopkeeperValidator)

    if (confirm !== params.shopkeeperId) {
      return response.unprocessableEntity({
        errors: [
          {
            field: 'confirm',
            rule: 'confirmMismatch',
            message: `Type ${params.shopkeeperId} exactly to delete this shop`,
          },
        ],
      })
    }

    const removed = await deleteShop(params.shopkeeperId)

    if (!removed) {
      return response.notFound({ message: 'No such shop' })
    }

    return response.ok({
      data: {
        removed,
        message: `Deleted ${params.shopkeeperId} and ${removed.cards} card(s).`,
      },
    })
  }

  /**
   * One shop's cards, live or completed, searchable and paged.
   *
   * The shop comes from the URL here rather than from a session — which is
   * only safe because this whole controller is behind the admin middleware.
   */
  async cards({ params, request, response }: HttpContext) {
    const shopkeeper = await shopkeepers.findByShopkeeperId(params.shopkeeperId)

    if (!shopkeeper) {
      return response.notFound({ message: 'No such shop' })
    }

    const page = readPage(request.input('page'))
    const perPage = readPerPage(request.input('perPage'))

    const result = await cards.listForShop(shopkeeper.shopkeeperId, {
      completed: request.input('completed') === 'true',
      search: request.input('search'),
      page,
      perPage,
    })

    return response.ok({
      data: result.cards.map((card) => cards.toPublic(card)),
      meta: {
        page,
        perPage,
        total: result.total,
        lastPage: Math.max(1, Math.ceil(result.total / perPage)),
        shopkeeper: shopkeepers.toPublic(shopkeeper),
      },
    })
  }
}

function readPage(value: unknown): number {
  const page = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

/** Clamped: an unbounded perPage is a way to ask for the entire database. */
function readPerPage(value: unknown): number {
  const perPage = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(perPage) ? Math.min(Math.max(perPage, 1), 100) : DEFAULT_PER_PAGE
}
