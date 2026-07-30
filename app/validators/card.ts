import { parseCalendarDate, todayUtc } from '#services/cards'
import shopkeepers from '#services/shopkeepers'
import vine from '@vinejs/vine'

/**
 * Rejects an issue date in the future.
 *
 * A card is issued when the customer is standing at the counter, so "issued"
 * is always today or earlier — backdating while catching up on the paper
 * register is fine, forward-dating is a slip. Without this, mistyping the year
 * saves a card issued a year from now, whose due-date maths then reads as
 * nonsense: a full year still to run on a card whose own dates are a day
 * apart.
 */
const notInFuture = vine.createRule(
  (value: unknown, _options: undefined, field) => {
    if (typeof value !== 'string') return

    const date = parseCalendarDate(value)
    if (!date) return

    if (date.getTime() > todayUtc().getTime()) {
      field.report('A card cannot be issued in the future', 'notInFuture', field)
    }
  },
  { name: 'notInFuture' }
)

/**
 * A plain calendar date, YYYY-MM-DD.
 *
 * Checked by parsing rather than by pattern alone: 2026-02-31 matches the
 * shape perfectly and is not a day.
 */
const calendarDate = vine.createRule(
  (value: unknown, _options: undefined, field) => {
    if (typeof value !== 'string') return

    if (!parseCalendarDate(value)) {
      field.report('Enter a real date', 'calendarDate', field)
    }
  },
  { name: 'calendarDate' }
)

/**
 * Rejects a date that falls before the card was issued.
 *
 * Read off `field.data` — the whole payload under validation — because the
 * rule needs another field, and the two are only wrong in relation to each
 * other. Reported on the later date, since that is the one to change.
 */
const notBeforeIssue = vine.createRule(
  (value: unknown, _options: undefined, field) => {
    if (typeof value !== 'string') return

    const date = parseCalendarDate(value)
    const issued =
      typeof field.data?.issueDate === 'string' ? parseCalendarDate(field.data.issueDate) : null

    // Either being unparseable is already reported by calendarDate; there is
    // nothing to compare and a second message would only be noise.
    if (!date || !issued) return

    if (date.getTime() < issued.getTime()) {
      field.report('This cannot be before the issue date', 'notBeforeIssue', field)
    }
  },
  { name: 'notBeforeIssue' }
)

/**
 * Adding a card to a shop's register.
 *
 * Three schema fields are absent on purpose, because none of them is the
 * client's to set: the CardID is the primary key and is assigned when the card
 * is created, the card number is generated per shop so that two cards can
 * never share one, and the ShopkeeperID comes from the session. A client that
 * could name any of them could file a card into somebody else's register or
 * collide with an existing card.
 *
 * Status is absent too — it is derived from the dates rather than declared.
 */
export const createCardValidator = vine.create({
  customerName: vine.string().trim().minLength(2).maxLength(60),

  /**
   * The same normalise-then-check as a shopkeeper's own mobile, so one number
   * has one spelling everywhere in the app. Not unique, though: one customer
   * can hold several cards, and families share numbers.
   */
  customerMobile: vine
    .string()
    .parse((value) =>
      typeof value === 'string' ? shopkeepers.normaliseMobile(value.trim()) : value
    )
    .regex(/^[6-9]\d{9}$/),

  issueDate: vine.string().trim().use(calendarDate()).use(notInFuture()),

  /** Next renewal or service date. */
  dueDate: vine.string().trim().use(calendarDate()).use(notBeforeIssue()),

  /** Optional — plenty of cards have a renewal date but no hard expiry. */
  expiryDate: vine.string().trim().use(calendarDate()).use(notBeforeIssue()).optional(),

  notes: vine.string().trim().maxLength(200).optional(),
})

/**
 * Editing a card.
 *
 * Every field is optional — an edit sends only what changed, and anything
 * absent is left alone. What is *missing* from this list is the point: the
 * issue date, the card number, the CardID and the shop cannot be edited, and
 * the due date can only move by way of a renewal.
 *
 * `notes` is nullable as well as optional, so clearing a note is possible —
 * absent means "leave it", null means "empty it".
 */
export const updateCardValidator = vine.create({
  customerName: vine.string().trim().minLength(2).maxLength(60).optional(),

  notes: vine.string().trim().maxLength(200).nullable().optional(),

  /**
   * true closes the card: the work is done, and it stops being tracked and
   * counted. false reopens it, and its status goes back to whatever its dates
   * now say.
   */
  completed: vine.boolean().optional(),

  /**
   * Renews the card by moving the due date out to this date.
   *
   * It has to be later than the current due date — a check that needs the
   * stored card, so it lives in the service rather than here. All this rule
   * can say is that the value is a real day.
   */
  newDueDate: vine.string().trim().use(calendarDate()).optional(),
})
