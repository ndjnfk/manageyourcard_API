import cards, {
  type CardFilter,
  InvalidRenewalError,
  type PublicCard,
  parseCalendarDate,
} from '#services/cards'
import { createCardValidator, updateCardValidator } from '#validators/card'
import type { HttpContext } from '@adonisjs/core/http'

/** Matches the service's own default, so the meta reports the size actually used. */
const DEFAULT_PER_PAGE = 12

const FILTERS: readonly CardFilter[] = ['all', 'active', 'today', 'week', 'expired']

/**
 * Reads the filter from the query string, ignoring anything unrecognised.
 *
 * A whitelist rather than a cast: the value reaches a database query, and an
 * unknown one should quietly mean "all" rather than being trusted.
 */
function readFilter(value: unknown): CardFilter | undefined {
  return FILTERS.includes(value as CardFilter) ? (value as CardFilter) : undefined
}

/**
 * A shop's card register.
 *
 * Every action takes the shop from `ctx.shopkeeper`, which the session
 * middleware resolved — never from the request. That is what makes it
 * impossible to read or write another shop's cards by editing a payload.
 */
export default class CardsController {
  /**
   * This shop's cards, with statuses brought up to date.
   *
   * `?completed=true` returns the closed ones — the history — and the default
   * returns only the live register. They are never mixed: a finished card
   * counted among the due ones would make every figure on the dashboard wrong.
   *
   * `?search=`, `?filter=` and `?page=` narrow and page the list. Paging only
   * happens when a page is asked for: the dashboard derives its counts from
   * the whole register, so a default page size would quietly break it.
   */
  async index({ shopkeeper, request, response }: HttpContext) {
    const page = Number.parseInt(request.input('page', ''), 10)
    const perPage = Number.parseInt(request.input('perPage', ''), 10)

    const result = await cards.listForShop(shopkeeper.shopkeeperId, {
      completed: request.input('completed') === 'true',
      search: request.input('search'),
      filter: readFilter(request.input('filter')),
      page: Number.isFinite(page) && page > 0 ? page : undefined,
      // Clamped: an unbounded perPage is a way to ask the server for
      // everything at once, and 0 or a negative would page forever.
      perPage: Number.isFinite(perPage) ? Math.min(Math.max(perPage, 1), 100) : undefined,
    })

    const body: { data: PublicCard[]; meta?: object } = {
      data: result.cards.map((card) => cards.toPublic(card)),
    }

    if (Number.isFinite(page) && page > 0) {
      const size = Number.isFinite(perPage) ? Math.min(Math.max(perPage, 1), 100) : DEFAULT_PER_PAGE
      body.meta = {
        page,
        perPage: size,
        total: result.total,
        lastPage: Math.max(1, Math.ceil(result.total / size)),
      }
    }

    return response.ok(body)
  }

  /** Adds a card. The CardID and the card number are assigned here. */
  async store({ shopkeeper, request, response }: HttpContext) {
    const payload = await request.validateUsing(createCardValidator)

    const card = await cards.create(shopkeeper.shopkeeperId, {
      customerName: payload.customerName,
      customerMobile: payload.customerMobile,
      // Already proven parseable by the validator's calendarDate rule.
      issueDate: parseCalendarDate(payload.issueDate)!,
      dueDate: parseCalendarDate(payload.dueDate)!,
      expiryDate: payload.expiryDate ? parseCalendarDate(payload.expiryDate) : null,
      notes: payload.notes ?? null,
    })

    return response.created({ data: cards.toPublic(card) })
  }

  /**
   * Edits a card — its customer name, its notes, whether it is closed, and
   * whether it has just been renewed.
   *
   * A card belonging to another shop produces the same 404 as one that does
   * not exist. That is deliberate: telling the difference would confirm that
   * somebody else's CardID is real.
   */
  async update({ shopkeeper, request, response, params }: HttpContext) {
    const payload = await request.validateUsing(updateCardValidator)

    try {
      const card = await cards.update(shopkeeper.shopkeeperId, params.cardId, {
        customerName: payload.customerName,
        notes: payload.notes,
        completed: payload.completed,
        // Already proven parseable by the validator's calendarDate rule.
        newDueDate: payload.newDueDate ? parseCalendarDate(payload.newDueDate)! : undefined,
      })

      if (!card) {
        return response.notFound({ message: 'That card is not in your register' })
      }

      return response.ok({ data: cards.toPublic(card) })
    } catch (error) {
      // Reported in the validator's own shape, so the form reads it the same
      // way whichever end of the request noticed the problem.
      if (error instanceof InvalidRenewalError) {
        return response.unprocessableEntity({
          errors: [{ field: error.field, rule: 'renewalNotLater', message: error.message }],
        })
      }
      throw error
    }
  }
}
