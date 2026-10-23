import mongodb from '#services/mongodb'
import shopkeepers from '#services/shopkeepers'
import {
  AnyBulkWriteOperation,
  Collection,
  Document,
  Filter,
  MongoServerError,
  ObjectId,
} from 'mongodb'

/** The collection every card is stored in. */
const COLLECTION = 'cards'

/**
 * CardIDs are drawn from the same counters collection as ShopkeeperIDs, and
 * like them the run is global rather than per shop: a CardID is the primary
 * key, so one has to mean exactly one card everywhere.
 *
 * Card *numbers* are a different thing — see the field docs below.
 */
const COUNTERS_COLLECTION = 'counters'
const CARD_ID_SEQUENCE = 'cardId'

/**
 * Card numbers run per shop, so each shop's register starts at C001 rather
 * than sharing one run of numbers with every other shop.
 */
const CARD_NUMBER_SEQUENCE_PREFIX = 'cardNumber:'

const ID_PREFIX = 'CRD'
const ID_DIGITS = 5

const NUMBER_PREFIX = 'C'
const NUMBER_DIGITS = 3

/**
 * How many times to try for a free card number before giving up.
 *
 * The counter makes a collision unlikely, but not impossible — a register that
 * already contains a number matching the pattern (imported, or from an earlier
 * scheme) will collide until the counter passes it. Each retry consumes one
 * counter value, so this converges quickly.
 */
const NUMBER_ATTEMPTS = 25

/** How close a due date has to be before a card counts as due soon. */
const DUE_SOON_DAYS = 7

/**
 * How long an expired card stays on the dashboard and the register.
 *
 * One day. A card that has just expired is still worth seeing where the
 * shopkeeper is already looking — they may want to call the customer about it —
 * but after that it is history, and leaving it among the live cards makes the
 * register a list of things that cannot be acted on.
 */
const EXPIRED_GRACE_DAYS = 1

/**
 * How long anything stays on the history page before it is deleted.
 *
 * Four days from the day it arrives there. This is a real deletion, not a
 * hiding: the document goes, and with it the customer's name, number, dates and
 * renewal count. Nothing recovers it.
 */
const HISTORY_KEEP_DAYS = 4

/** A whole number of days before or after `date`, at UTC midnight. */
function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/**
 * The queries that place a card in its stage of life, all derived from one
 * `today` so that no two of them can disagree.
 *
 * A card moves: live → history → deleted. The boundaries have to be written
 * once, because the register, the history page and the purge each need the same
 * line drawn and drawing it three times is how a card ends up on two pages at
 * once, or on neither.
 */
function lifecycle(today: Date) {
  /** Expired long enough ago to have left the register. */
  const pastGrace = { expiryDate: { $ne: null, $lt: shiftDays(today, -EXPIRED_GRACE_DAYS) } }

  return {
    /**
     * Still on the dashboard and the register: not closed, and either without
     * an expiry or inside the grace day.
     *
     * `$nor` rather than a negated `$lt`, because in BSON ordering null sorts
     * before every date — a bare comparison would sweep out every card that has
     * no expiry at all, which is most of them.
     */
    live: { completedAt: null, $nor: [pastGrace] } as Filter<CardDocument>,

    /** On the history page: closed by the shopkeeper, or past its grace day. */
    history: { $or: [{ completedAt: { $ne: null } }, pastGrace] } as Filter<CardDocument>,

    /**
     * Due for deletion: four days on the history page, counting the day it
     * arrived there — the day it was closed, or the day after its grace ended.
     *
     * The two offsets differ by two, and the difference is not a mistake.
     * `completedAt` is a timestamp on the day the card arrived, so it is
     * already inside its first day; `expiryDate` is two days before the card
     * reaches the page at all — one day of grace on the register, and the
     * comparison being strict. Both then run for four days:
     *
     *   closed on the 1st   → shows 1–4  → deleted on the 5th
     *   expires on the 1st  → shows 3–6  → deleted on the 7th
     */
    purge: {
      $or: [
        {
          completedAt: { $ne: null, $lt: shiftDays(today, -(HISTORY_KEEP_DAYS - 1)) },
        },
        {
          expiryDate: {
            $ne: null,
            $lt: shiftDays(today, -(EXPIRED_GRACE_DAYS + HISTORY_KEEP_DAYS)),
          },
        },
      ],
    } as Filter<CardDocument>,
  }
}

/**
 * The states a card can be in.
 *
 * The first three are derived from the dates and change on their own as time
 * passes. "Completed" is different in kind: it is declared by the shopkeeper
 * when the work is done, and once set it overrides the others — a finished
 * card is not "expired", it is simply finished, and nothing about it needs
 * tracking any more.
 */
export type CardStatus = 'Active' | 'Due Soon' | 'Expired' | 'Completed'

/** A card as it is stored. */
export interface CardDocument {
  _id: ObjectId
  /** Primary key, e.g. "CRD-00001". Assigned here, never sent by the client. */
  cardId: string
  /**
   * The shop this card belongs to — the foreign key. Every read and write in
   * this service is filtered by it: it is the only thing keeping one shop's
   * register out of another's.
   */
  shopkeeperId: string
  /**
   * The number that goes on the physical card, e.g. "C001".
   *
   * Assigned here rather than typed: it only has to be unique, and a number
   * the shopkeeper picks at a busy counter is exactly the thing that gets
   * repeated. Unique within the shop — two shops both having a C001 is correct
   * and expected, so the uniqueness is scoped, not global.
   */
  cardNumber: string
  customerName: string
  /** Normalised to bare 10 digits, the same as a shopkeeper's own. */
  customerMobile: string
  /**
   * Dates held at UTC midnight.
   *
   * These are dates, not moments — "due on the 14th" is true regardless of the
   * hour or the reader's timezone. Storing them at midnight UTC and formatting
   * them back as plain YYYY-MM-DD keeps a card from appearing to fall due a day
   * early for anyone east or west of the server.
   */
  issueDate: Date
  /** Next renewal or service date. */
  dueDate: Date
  /** Optional: when the card itself stops being valid. */
  expiryDate: Date | null
  /**
   * When the shopkeeper marked the card done, or null while it is still live.
   *
   * This is what takes a card out of the register: a completed card is not
   * counted, not chased and not shown on the dashboard — it moves to the
   * history page. Kept as a timestamp rather than a boolean because "when was
   * this closed" is the first thing anyone asks of a history list.
   */
  completedAt: Date | null
  /**
   * When the card was last renewed, or null if it never has been.
   *
   * A renewal is not an edit: the due date moving is the thing the shop
   * actually did for the customer, so it is recorded rather than silently
   * overwritten. Keeping the moment as well as the count is what lets "when
   * did we last renew this" be answered.
   */
  renewedAt: Date | null
  /** How many times the card has been renewed. 0 until the first one. */
  renewalCount: number
  /**
   * Stored so it can be queried and reported on, but never trusted as written:
   * a card saved as Active becomes Expired purely by time passing, with nobody
   * touching the record. `listForShop` recomputes it on every read and writes
   * back any that have drifted, so the column is both queryable and true.
   */
  status: CardStatus
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

/** The fields an edit may change. Anything absent is left alone. */
export interface CardChanges {
  customerName?: string
  notes?: string | null
  /** true closes the card, false reopens it. */
  completed?: boolean
  /**
   * Renews the card: moves the due date out and records that it happened.
   *
   * Separate from the other fields because it is not a correction — it is the
   * shop having done the work. Must be later than the current due date; a date
   * that isn't is a mistake, not a renewal.
   */
  newDueDate?: Date
}

/**
 * Raised when a renewal's new due date is not actually later than the current
 * one. Carries the field so the form can point at the input.
 */
export class InvalidRenewalError extends Error {
  readonly field = 'newDueDate'

  constructor(currentDueDate: Date) {
    super(`A renewal must move the due date past ${formatCalendarDate(currentDueDate)}`)
  }
}

/** A card as the API returns it. Dates come back as plain calendar dates. */
export interface PublicCard {
  cardId: string
  cardNumber: string
  customerName: string
  customerMobile: string
  issueDate: string
  dueDate: string
  expiryDate: string | null
  completedAt: string | null
  renewedAt: string | null
  renewalCount: number
  status: CardStatus
  notes: string | null
  createdAt: string
}

/**
 * What creating a card supplies. The CardID, the card number and the shop are
 * all added here — none of them is the client's to choose.
 */
export interface NewCard {
  customerName: string
  customerMobile: string
  issueDate: Date
  dueDate: Date
  expiryDate?: Date | null
  notes?: string | null
}

/** The buckets the register can be narrowed to, matching the dashboard's. */
/**
 * The buckets the register can be narrowed to.
 *
 * 'overdue' and 'expired' are separate because they call for opposite things.
 * An overdue card has a renewal date that has gone by and is exactly what the
 * shopkeeper should be chasing; an expired one has run out and cannot be
 * renewed at all. They used to share a bucket, which meant the list of cards to
 * chase was padded with cards nobody could do anything about.
 */
export type CardFilter = 'all' | 'active' | 'today' | 'week' | 'overdue' | 'expired'

/** How a listing is narrowed and paged. Everything is optional. */
export interface ListOptions {
  /** true lists the closed cards — the history — instead of the live register. */
  completed?: boolean
  /** Matches card number, customer name or mobile. */
  search?: string
  filter?: CardFilter
  /** 1-based. Absent means "everything", which is what the dashboard needs. */
  page?: number
  perPage?: number
}

export interface ListResult {
  cards: CardDocument[]
  /** Matching cards in total, not just on this page. Drives the pager. */
  total: number
}

/**
 * Escapes a user's search text so it is matched literally.
 *
 * Without this, a customer searching for "C001." would have the dot match any
 * character — and a stray "(" would throw rather than find nothing.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Parses YYYY-MM-DD into the UTC midnight it names, or null if it isn't one. */
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))

  // Rejects the dates that look right but aren't — 2026-02-31 would otherwise
  // roll over into March rather than being refused.
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null
  }

  return date
}

/** Formats a stored date back to the plain YYYY-MM-DD it represents. */
function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Today at UTC midnight — what every stored date is compared against. */
export function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

const DAY_MS = 86_400_000

/**
 * Works out a card's status from its dates.
 *
 * Expiry wins over the due date: a card that has expired cannot meaningfully
 * be "due soon" for a renewal it is too late to make.
 */
export function statusFor(
  dueDate: Date,
  expiryDate: Date | null,
  today: Date = todayUtc()
): CardStatus {
  if (expiryDate && expiryDate.getTime() < today.getTime()) return 'Expired'
  if (dueDate.getTime() < today.getTime()) return 'Expired'

  const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / DAY_MS)
  return daysUntilDue <= DUE_SOON_DAYS ? 'Due Soon' : 'Active'
}

/**
 * A card's status, completion included.
 *
 * Being finished beats every date-derived state: a card the shopkeeper has
 * closed is not "expired" just because its due date has since passed. This is
 * the only function that should decide a status — `statusFor` above knows
 * nothing about completion.
 */
export function statusOf(
  card: Pick<CardDocument, 'dueDate' | 'expiryDate' | 'completedAt'>,
  today: Date = todayUtc()
): CardStatus {
  if (card.completedAt) return 'Completed'

  return statusFor(card.dueDate, card.expiryDate, today)
}

/**
 * Turns a bucket into the query that selects it, or null for "all".
 *
 * These mirror `statusFor` exactly, expiry included: a card whose expiry has
 * passed is Expired whatever its due date says, so it must not turn up under
 * "due this week" — the badge on it would read Expired and the filter would
 * look broken.
 */
function bucketQuery(filter: CardFilter | undefined, today: Date): Filter<CardDocument> | null {
  if (!filter || filter === 'all') return null

  const weekEnd = new Date(today.getTime() + DUE_SOON_DAYS * DAY_MS)

  // Written out rather than `{ $lt: today }`: in BSON ordering null sorts
  // before every date, so a bare $lt would match every card without an expiry.
  const expiryPassed = { expiryDate: { $ne: null, $lt: today } }
  const expiryLive = { $or: [{ expiryDate: null }, { expiryDate: { $gte: today } }] }

  switch (filter) {
    // Due date gone by, but the card itself is still alive — the ones worth
    // ringing someone about. `expiryLive` is what keeps a card that has run
    // out from padding the chase list.
    case 'overdue':
      return { $and: [{ dueDate: { $lt: today } }, expiryLive] }
    // Run out. Nothing about the due date matters here: expiry outranks it, so
    // a card that expired while its renewal was still days away belongs in
    // this bucket and in no other.
    case 'expired':
      return expiryPassed
    case 'today':
      return { $and: [{ dueDate: today }, expiryLive] }
    case 'week':
      return { $and: [{ dueDate: { $gt: today, $lte: weekEnd } }, expiryLive] }
    case 'active':
      return { $and: [{ dueDate: { $gt: weekEnd } }, expiryLive] }
  }
}

/**
 * The card register.
 *
 * Every method takes a `shopkeeperId` and every query filters on it. That is
 * deliberate and not negotiable: the whole product promise is that a shop sees
 * its own cards and nobody else's, and a query here that forgets the filter is
 * how that promise breaks.
 */
class Cards {
  get collection(): Collection<CardDocument> {
    return mongodb.collection<CardDocument>(COLLECTION)
  }

  toPublic(card: CardDocument): PublicCard {
    return {
      cardId: card.cardId,
      cardNumber: card.cardNumber,
      customerName: card.customerName,
      customerMobile: card.customerMobile,
      issueDate: formatCalendarDate(card.issueDate),
      dueDate: formatCalendarDate(card.dueDate),
      expiryDate: card.expiryDate ? formatCalendarDate(card.expiryDate) : null,
      completedAt: card.completedAt ? card.completedAt.toISOString() : null,
      renewedAt: card.renewedAt ? card.renewedAt.toISOString() : null,
      // Cards created before renewals were tracked have no count at all, and
      // "never renewed" is the right reading of that.
      renewalCount: card.renewalCount ?? 0,
      status: card.status,
      notes: card.notes,
      createdAt: card.createdAt.toISOString(),
    }
  }

  /**
   * Idempotent — MongoDB ignores an index that already exists.
   */
  async createIndexes(): Promise<void> {
    await this.collection.createIndexes([
      { key: { cardId: 1 }, name: 'card_id_unique', unique: true },
      // Scoped, not global: a card number only has to be unique inside the
      // shop that issued it.
      {
        key: { shopkeeperId: 1, cardNumber: 1 },
        name: 'shopkeeper_card_number_unique',
        unique: true,
      },
      // Every listing is "this shop's cards, soonest due first".
      { key: { shopkeeperId: 1, dueDate: 1 }, name: 'shopkeeper_due_date' },
    ])
  }

  /**
   * Draws the next CardID.
   *
   * As with ShopkeeperIDs, an atomic $inc rather than a count of existing
   * cards: two cards added at once must not both be handed CRD-00007, and
   * deleting a card must not cause the next one to reuse its ID.
   */
  async nextCardId(): Promise<string> {
    const counter = await mongodb
      .collection<{ _id: string; seq: number }>(COUNTERS_COLLECTION)
      .findOneAndUpdate(
        { _id: CARD_ID_SEQUENCE },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      )

    const seq = counter?.seq ?? 1
    return `${ID_PREFIX}-${String(seq).padStart(ID_DIGITS, '0')}`
  }

  /**
   * Draws the next card number for one shop.
   *
   * Same atomic $inc as everywhere else: two cards added at the same moment
   * must not both be handed C007, and deleting a card must not let the next
   * one reuse its number. The unique index is what makes that a guarantee
   * rather than a hope — see the retry in `create`.
   */
  async nextCardNumber(shopkeeperId: string): Promise<string> {
    const counter = await mongodb
      .collection<{ _id: string; seq: number }>(COUNTERS_COLLECTION)
      .findOneAndUpdate(
        { _id: `${CARD_NUMBER_SEQUENCE_PREFIX}${shopkeeperId}` },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      )

    const seq = counter?.seq ?? 1
    return `${NUMBER_PREFIX}${String(seq).padStart(NUMBER_DIGITS, '0')}`
  }

  /**
   * One shop's cards.
   *
   * `completed` splits the register in two: the live cards the dashboard
   * chases, and the closed ones the history page shows. They are never mixed —
   * a finished card in the counts would make every number on the dashboard
   * wrong.
   *
   * Live cards come soonest-due first, because that is the order they need
   * acting on. Completed ones come most-recently-closed first, because that is
   * the order a history is read in.
   *
   * Statuses are recomputed here and any that have drifted are written back.
   * A card goes from Due Soon to Expired with nobody touching it, so a status
   * that is only set on write is wrong within days — this keeps the stored
   * column true without needing a scheduled job.
   */
  async listForShop(shopkeeperId: string, options: ListOptions = {}): Promise<ListResult> {
    const { completed = false, page, perPage = 12 } = options
    const today = todayUtc()

    // `completed` names the two pages, not the flag: the history page holds
    // cards the shopkeeper closed *and* cards whose expiry ran out days ago,
    // and the register holds neither. A missing completedAt and a null one both
    // mean "still live" — the field did not exist before cards could be closed.
    const stage = lifecycle(today)
    const query: Filter<CardDocument> = {
      shopkeeperId,
      ...(completed ? stage.history : stage.live),
    }

    // Collected into $and rather than merged, because the search and the filter
    // can each need their own $or — and a second $or key would silently
    // replace the first.
    const conditions: Filter<CardDocument>[] = []

    const search = options.search?.trim()
    if (search) {
      const pattern = new RegExp(escapeRegExp(search), 'i')
      conditions.push({
        $or: [{ cardNumber: pattern }, { customerName: pattern }, { customerMobile: pattern }],
      })
    }

    const bucket = bucketQuery(options.filter, today)
    if (bucket) conditions.push(bucket)

    if (conditions.length > 0) query.$and = conditions

    // History is read most-recent-first, and it now holds two kinds of card.
    // `expiryDate` is the tie-break because an expired card has no completedAt
    // at all — without it every expired card would land in one undifferentiated
    // clump at the end, in whatever order the collection happened to return.
    //
    // The register is newest-issued first, with the cards inside their day of
    // grace pushed to the bottom. "Expired" is a comparison against today
    // rather than a stored field, so this is a pipeline and not a `.sort()`:
    // MongoDB can only sort by values it holds, and the stored `status` is no
    // substitute — it is refreshed *after* this query returns, so on the first
    // read of a day it is exactly one day out of date.
    //
    // Sorting has to happen before skip/limit, or page 2 would be sorted
    // within itself rather than being the second page of one ordering.
    const stages: Document[] = [{ $match: query }]

    if (completed) {
      stages.push({ $sort: { completedAt: -1, expiryDate: -1, _id: 1 } })
    } else {
      stages.push(
        {
          $addFields: {
            // `$ne: null` first and deliberately: in BSON ordering null sorts
            // before every date, so `$lt` alone would call every card without
            // an expiry expired — which is most of them.
            _expired: {
              $and: [{ $ne: ['$expiryDate', null] }, { $lt: ['$expiryDate', today] }],
            },
          },
        },
        // `_id` last so the order is total. Two cards issued the same day would
        // otherwise be free to swap places between requests, which on a paged
        // list means a card can appear twice or not at all.
        { $sort: { _expired: 1, issueDate: -1, _id: 1 } },
        { $unset: '_expired' }
      )
    }

    // Only paged when a page was asked for. The dashboard derives its counts
    // from the whole register, so a default page size would quietly break it.
    if (page && page > 0) {
      stages.push({ $skip: (page - 1) * perPage }, { $limit: perPage })
    }

    const [register, total] = await Promise.all([
      this.collection.aggregate<CardDocument>(stages).toArray(),
      this.collection.countDocuments(query),
    ])
    const drifted: AnyBulkWriteOperation<CardDocument>[] = []

    for (const card of register) {
      const current = statusOf(card, today)
      if (current === card.status) continue

      card.status = current
      drifted.push({
        updateOne: {
          filter: { _id: card._id },
          update: { $set: { status: current, updatedAt: new Date() } },
        },
      })
    }

    if (drifted.length > 0) {
      await this.collection.bulkWrite(drifted)
    }

    return { cards: register, total }
  }

  /**
   * The live cards a reminder should mention: everything already overdue, plus
   * everything falling due within `leadDays`.
   *
   * A query rather than a filter over `listForShop`, because the nightly sweep
   * runs across every shop and only wants the handful of cards that need
   * chasing — loading each shop's whole register to discard most of it would
   * make the sweep's cost scale with cards held rather than cards due.
   *
   * Completed cards are excluded the same way as everywhere else: a closed card
   * is finished, and reminding anyone about it would be wrong.
   *
   * No lower bound on the overdue end. A card three months past its due date is
   * still an outstanding renewal that nobody has closed, and a reminder that
   * quietly stopped mentioning it would be the app losing track of exactly the
   * thing it exists to track.
   */
  async dueForReminder(shopkeeperId: string, leadDays: number): Promise<CardDocument[]> {
    const today = todayUtc()
    const horizon = new Date(today.getTime() + leadDays * DAY_MS)

    return this.collection
      .find({
        shopkeeperId,
        // The same `live` set the register shows, rather than "not completed".
        // A card whose grace day is over has moved to the history page and is
        // days from being deleted; reminding a shop about it every morning is
        // notifying them about something the app has already filed away.
        ...lifecycle(today).live,
        dueDate: { $lte: horizon },
      })
      .sort({ dueDate: 1 })
      .toArray()
  }

  /**
   * One card, or null.
   *
   * `shopkeeperId` is part of the query rather than checked afterwards. A shop
   * asking for a CardID that is not theirs must get "no such card", not
   * somebody else's customer — and the surest way to guarantee that is for the
   * lookup to be incapable of finding it.
   *
   * The stored status is refreshed on the way out, for the same reason the list
   * does it: a card goes from Due Soon to Expired with nobody touching it, so a
   * status only written on save is wrong within days.
   */
  async findForShop(shopkeeperId: string, cardId: string): Promise<CardDocument | null> {
    const card = await this.collection.findOne({ cardId, shopkeeperId })
    if (!card) return null

    const current = statusOf(card)

    if (current !== card.status) {
      card.status = current
      await this.collection.updateOne(
        { _id: card._id },
        { $set: { status: current, updatedAt: new Date() } }
      )
    }

    return card
  }

  /**
   * Deletes every card that has served its four days on the history page.
   *
   * **This destroys data and nothing recovers it.** The document goes: the
   * customer's name and number, the dates, the renewal count, the note. A card
   * deleted here cannot be looked up later to answer "has this customer been in
   * before?", because there is no longer anything to look up.
   *
   * Deliberately a swept job rather than a delete on read. A page that quietly
   * destroyed records while being looked at would make the amount of data lost
   * depend on who happened to open which screen, and a shop that did not log in
   * for a fortnight would lose everything at once on the day they did.
   *
   * Returns how many were deleted, so the run can be logged honestly — this is
   * the one job where "it did nothing" and "it removed forty cards" must not
   * look the same afterwards.
   */
  async purgeHistory(): Promise<number> {
    const result = await this.collection.deleteMany(lifecycle(todayUtc()).purge)

    return result.deletedCount
  }

  /**
   * What `purgeHistory` would delete, without deleting it.
   *
   * Exists so the boundary can be checked against real data before anything is
   * destroyed, and so a scheduled run can be rehearsed. There is no undo to
   * fall back on, which makes a dry run the only safety there is.
   */
  async purgeCandidates(): Promise<CardDocument[]> {
    return this.collection.find(lifecycle(todayUtc()).purge).sort({ cardNumber: 1 }).toArray()
  }

  /**
   * Adds a card to one shop's register and returns it, with its CardID and its
   * card number both assigned.
   *
   * The insert is retried on a duplicate card number rather than failing. The
   * counter alone cannot promise uniqueness — a register may already hold a
   * number the counter has yet to pass — so the unique index is the authority
   * and this simply takes the next number when it says no. That is what makes
   * "no two cards share a number" true rather than merely likely.
   */
  async create(shopkeeperId: string, input: NewCard): Promise<CardDocument> {
    const now = new Date()
    const expiryDate = input.expiryDate ?? null
    const cardId = await this.nextCardId()

    for (let attempt = 0; attempt < NUMBER_ATTEMPTS; attempt++) {
      const document: CardDocument = {
        _id: new ObjectId(),
        cardId,
        shopkeeperId,
        cardNumber: await this.nextCardNumber(shopkeeperId),
        customerName: input.customerName.trim(),
        customerMobile: shopkeepers.normaliseMobile(input.customerMobile),
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        expiryDate,
        completedAt: null,
        renewedAt: null,
        renewalCount: 0,
        status: statusFor(input.dueDate, expiryDate),
        notes: input.notes?.trim() || null,
        createdAt: now,
        updatedAt: now,
      }

      try {
        await this.collection.insertOne(document)
        return document
      } catch (error) {
        const duplicateNumber =
          error instanceof MongoServerError &&
          error.code === 11000 &&
          String(Object.keys(error.keyPattern ?? {})).includes('cardNumber')

        // Anything else — including a CardID collision, which is not the
        // shopkeeper's doing — is a real failure and must not be swallowed.
        if (!duplicateNumber) throw error
      }
    }

    throw new Error(
      `Could not find a free card number for ${shopkeeperId} after ${NUMBER_ATTEMPTS} attempts`
    )
  }

  /**
   * Edits a card and returns it, or null if this shop has no such card.
   *
   * The filter carries the ShopkeeperID as well as the CardID. Matching on the
   * CardID alone would let one shop edit another's card simply by knowing an
   * ID — and IDs are sequential, so guessing them is trivial. The 404 that a
   * null produces is also the right answer: another shop's card should not
   * even be admitted to exist.
   *
   * Only the fields an edit is allowed to touch are settable here. The issue
   * date, the card number and the shop are all absent by design — and the due
   * date can only move through `newDueDate`, which records the renewal rather
   * than quietly rewriting history.
   *
   * @throws InvalidRenewalError when a renewal would not move the date forward.
   */
  async update(
    shopkeeperId: string,
    cardId: string,
    changes: CardChanges
  ): Promise<CardDocument | null> {
    const card = await this.collection.findOne({ cardId, shopkeeperId })
    if (!card) return null

    const update: Partial<CardDocument> = { updatedAt: new Date() }

    if (changes.customerName !== undefined) {
      update.customerName = changes.customerName.trim()
    }

    if (changes.notes !== undefined) {
      update.notes = changes.notes?.trim() || null
    }

    if (changes.newDueDate) {
      // A renewal that doesn't move the date forward isn't one. Refusing it
      // here keeps the count honest — otherwise a stray save would inflate
      // "renewed 3 times" without anything having been renewed.
      if (changes.newDueDate.getTime() <= card.dueDate.getTime()) {
        throw new InvalidRenewalError(card.dueDate)
      }

      update.dueDate = changes.newDueDate
      update.renewedAt = new Date()
      update.renewalCount = (card.renewalCount ?? 0) + 1
    }

    if (changes.completed !== undefined) {
      // Closing stamps the moment; reopening clears it, and the status falls
      // back to whatever the dates now say — which for a card that sat closed
      // past its due date is Expired, correctly.
      update.completedAt = changes.completed ? (card.completedAt ?? new Date()) : null
    }

    update.status = statusOf({ ...card, ...update })

    await this.collection.updateOne({ _id: card._id }, { $set: update })

    return { ...card, ...update }
  }
}

export default new Cards()
