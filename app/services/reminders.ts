import cards, { type CardDocument, todayUtc } from '#services/cards'
import inbox from '#services/inbox'
import mailer from '#services/mailer'
import { renderDueReminder } from '#mails/due_reminder'
import mongodb from '#services/mongodb'
import push from '#services/push'
import shopkeepers, { type ShopkeeperDocument, notificationsFor } from '#services/shopkeepers'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { Collection, MongoServerError, ObjectId } from 'mongodb'

/** Records which shop has already been reminded on which day. */
const LOG_COLLECTION = 'notificationLog'

const DAY_MS = 86_400_000

/** Fallback when REMINDER_LEAD_DAYS is unset — the dashboard's own window. */
const DEFAULT_LEAD_DAYS = 7

/**
 * The channels a reminder goes out on, logged separately per shop per day.
 *
 * 'inbox' is the in-app list the bell opens. It is a channel like the other two
 * so that it gets the same once-a-day guarantee from the same unique index —
 * and it is written even when push and email are both switched off, because
 * turning off the buzzing is not the same as asking not to be told.
 */
export type ReminderChannel = 'push' | 'email' | 'inbox' | 'due-today'

/** One row of the send log — the record that stops a second send in a day. */
interface ReminderLogDocument {
  _id: ObjectId
  shopkeeperId: string
  channel: ReminderChannel
  /** YYYY-MM-DD. Part of the unique key that makes a day's send once-only. */
  sentOn: string
  /** How many cards the reminder covered. Kept for the admin stats only. */
  cards: number
  createdAt: Date
}

/** One card as a reminder describes it. */
export interface DigestCard {
  cardNumber: string
  customerName: string
  customerMobile: string
  /** Plain YYYY-MM-DD, the same as the API returns everywhere else. */
  dueDate: string
  /** Negative when the date has passed, 0 for today. */
  daysUntilDue: number
}

/**
 * What one shop needs telling about today.
 *
 * Split into three buckets rather than one sorted list because they call for
 * different action and different wording: an overdue card is a phone call, a
 * card due today is today's work, and a card due this week is a heads-up.
 */
export interface ShopDigest {
  shopkeeperId: string
  shopName: string
  ownerName: string
  email: string
  /**
   * Cards whose own expiry has run out — finished, not merely late.
   *
   * Kept apart from `overdue` because they call for opposite things and used
   * to be told the same thing. An overdue card is a phone call: its renewal
   * date has gone by and it can still be renewed. An expired one cannot be
   * renewed at all, so a notification saying it is "due soon" was asking the
   * shopkeeper to do something the app itself would refuse.
   */
  expired: DigestCard[]
  overdue: DigestCard[]
  dueToday: DigestCard[]
  dueSoon: DigestCard[]
  /** Cards across all three buckets. Zero means there is nothing to send. */
  total: number
}

/** What one shop's reminder run did, per channel. */
export interface ReminderOutcome {
  shopkeeperId: string
  cards: number
  push: 'sent' | 'skipped' | 'failed' | 'already-sent' | 'off'
  email: 'sent' | 'skipped' | 'failed' | 'already-sent' | 'off'
  /** The in-app list. Never 'off' — it is written whatever the preferences say. */
  inbox: 'sent' | 'already-sent'
}

/** A day as YYYY-MM-DD, which is the grain reminders are deduplicated at. */
function calendarDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Turns a stored card into the shape a reminder describes it in.
 *
 * Both dates are UTC midnight, so the difference is a whole number of days and
 * needs no rounding for daylight saving — which is the reason the cards service
 * stores them that way.
 */
function toDigestCard(card: CardDocument, today: Date): DigestCard {
  return {
    cardNumber: card.cardNumber,
    customerName: card.customerName,
    customerMobile: card.customerMobile,
    dueDate: calendarDay(card.dueDate),
    daysUntilDue: Math.round((card.dueDate.getTime() - today.getTime()) / DAY_MS),
  }
}

/**
 * The nightly reminder run.
 *
 * One digest per shop per day rather than one notification per card: a shop with
 * fifteen cards due this week does not want fifteen buzzes, and the one that
 * matters would be lost among them. The digest is also what makes the run cheap
 * — one push and one email per shop, whatever the size of the register.
 */
class Reminders {
  get log(): Collection<ReminderLogDocument> {
    return mongodb.collection<ReminderLogDocument>(LOG_COLLECTION)
  }

  /** Idempotent — MongoDB ignores an index that already exists. */
  async createIndexes(): Promise<void> {
    await this.log.createIndexes([
      // The whole dedupe mechanism. A second run on the same day cannot insert
      // a second row, so it cannot send a second reminder — see `#claim`.
      {
        key: { shopkeeperId: 1, channel: 1, sentOn: 1 },
        name: 'reminder_once_per_day',
        unique: true,
      },
      // Lets old entries be swept without scanning the collection.
      { key: { createdAt: 1 }, name: 'reminder_log_created' },
    ])
  }

  /** How many days ahead this shop is reminded. Its own choice, or the server's. */
  leadDaysFor(shopkeeper: ShopkeeperDocument): number {
    return notificationsFor(shopkeeper).leadDays ?? env.get('REMINDER_LEAD_DAYS') ?? DEFAULT_LEAD_DAYS
  }

  /**
   * What one shop needs telling about, or null when the answer is nothing.
   *
   * Null rather than an empty digest, so callers cannot accidentally send
   * "you have 0 cards due" — which is noise, and the fastest way to have a
   * shopkeeper turn notifications off.
   */
  async buildDigest(shopkeeper: ShopkeeperDocument): Promise<ShopDigest | null> {
    const today = todayUtc()
    const due = await cards.dueForReminder(shopkeeper.shopkeeperId, this.leadDaysFor(shopkeeper))

    if (due.length === 0) return null

    const digest: ShopDigest = {
      shopkeeperId: shopkeeper.shopkeeperId,
      shopName: shopkeeper.shopName,
      ownerName: shopkeeper.ownerName,
      email: shopkeeper.email,
      expired: [],
      overdue: [],
      dueToday: [],
      dueSoon: [],
      total: due.length,
    }

    for (const card of due) {
      const entry = toDigestCard(card, today)

      // Expiry is checked before the due date and wins, exactly as it does on
      // the register. A card that ran out yesterday but is not due until
      // Sunday belongs in `expired` — telling its shop it is "due in 3 days"
      // would be true of the date and wrong about the card.
      if (card.expiryDate && card.expiryDate.getTime() < today.getTime()) {
        digest.expired.push(entry)
      } else if (entry.daysUntilDue < 0) digest.overdue.push(entry)
      else if (entry.daysUntilDue === 0) digest.dueToday.push(entry)
      else digest.dueSoon.push(entry)
    }

    return digest
  }

  /**
   * The cards that fall due today and are still open, or null if there are none.
   *
   * Derived from the full digest rather than queried again, because "due today"
   * is already one of the buckets it splits into — and deriving it means the
   * two can never disagree about what today holds.
   */
  async buildDueTodayDigest(shopkeeper: ShopkeeperDocument): Promise<ShopDigest | null> {
    const digest = await this.buildDigest(shopkeeper)
    if (!digest || digest.dueToday.length === 0) return null

    // Narrowed to today's cards only. The evening alert is about what did not
    // get done, so next week's renewals are noise in it — and so are expired
    // cards, which are not something the day could have closed.
    return {
      ...digest,
      expired: [],
      overdue: [],
      dueSoon: [],
      total: digest.dueToday.length,
    }
  }

  /**
   * The end-of-day nudge: cards that fell due today and are still not closed.
   *
   * Deliberately a *second* run late in the day rather than a second message in
   * the morning. The morning digest already opens with "4 cards are due today",
   * so an alert alongside it would be the same sentence twice. Sent hours later
   * it carries something the digest could not know — that the day is nearly
   * over and these are still open.
   *
   * Push and the in-app list only, never email. A shop that has already had one
   * email this morning does not want a second one at closing time, and the
   * unsubscribe that follows would cost them the useful one too.
   */
  async remindDueToday(
    shopkeeper: ShopkeeperDocument,
    force = false
  ): Promise<'sent' | 'nothing-due' | 'already-sent' | 'failed' | 'off'> {
    const digest = await this.buildDueTodayDigest(shopkeeper)
    if (!digest) return 'nothing-due'

    if (!force && !(await this.#claim(shopkeeper.shopkeeperId, 'due-today', digest.total))) {
      return 'already-sent'
    }

    const count = digest.total
    const title = count === 1 ? '1 card is still open today' : `${count} cards are still open today`
    const body = `${namesOf(digest.dueToday)} — due today and not closed yet.`

    // The in-app entry is written whatever the push preference says: it is the
    // record, not a delivery. Same reasoning as the daily digest.
    await inbox.add(shopkeeper.shopkeeperId, {
      kind: 'reminder',
      title,
      body,
      url: '/dashboard',
      counts: { overdue: 0, dueToday: count, dueSoon: 0, total: count },
    })

    if (!notificationsFor(shopkeeper).push) return 'off'

    const result = await push.sendToShop(shopkeeper.shopkeeperId, {
      title,
      body,
      url: '/dashboard',
      // Its own tag, so it sits alongside the morning digest rather than
      // replacing it — they say different things.
      tag: 'due-today',
    })

    if (result.sent > 0) return 'sent'
    if (result.skipped) return 'off'

    return 'failed'
  }

  /**
   * Runs the end-of-day nudge across every shop that wants reminders.
   *
   * Sequential for the same reason as the daily sweep: FCM rate-limits, and a
   * burst of parallel sends is what trips it.
   */
  async runDueTodaySweep(force = false): Promise<{ shopkeeperId: string; outcome: string }[]> {
    const register = await shopkeepers.withRemindersEnabled()
    const outcomes: { shopkeeperId: string; outcome: string }[] = []

    for (const shopkeeper of register) {
      try {
        outcomes.push({
          shopkeeperId: shopkeeper.shopkeeperId,
          outcome: await this.remindDueToday(shopkeeper, force),
        })
      } catch (error) {
        logger.error(
          { err: error, shopkeeperId: shopkeeper.shopkeeperId },
          'A shop could not be sent its end-of-day alert'
        )
      }
    }

    return outcomes
  }

  /**
   * Claims the right to send on one channel today.
   *
   * Returns false when this shop has already been reminded on this channel
   * today. The claim is the *insert*, not a read followed by an insert: two
   * sweeps running at once — a cron overlapping a manual run — would both pass
   * a "have we sent yet?" check and both send. Only the unique index can settle
   * it, and it settles it by refusing the second insert.
   */
  async #claim(shopkeeperId: string, channel: ReminderChannel, cardCount: number): Promise<boolean> {
    try {
      await this.log.insertOne({
        _id: new ObjectId(),
        shopkeeperId,
        channel,
        sentOn: calendarDay(new Date()),
        cards: cardCount,
        createdAt: new Date(),
      })
      return true
    } catch (error) {
      // 11000 is the unique index refusing a duplicate: already sent today.
      if (error instanceof MongoServerError && error.code === 11000) return false
      throw error
    }
  }

  /**
   * Releases a claim whose send then failed, so a later run can try again.
   *
   * Without this a transient Resend outage would mark the day as done and the
   * shop would simply not be reminded — the failure would cost them the
   * notification rather than a retry.
   */
  async #release(shopkeeperId: string, channel: ReminderChannel): Promise<void> {
    await this.log.deleteOne({ shopkeeperId, channel, sentOn: calendarDay(new Date()) })
  }

  /**
   * Reminds one shop on whichever channels it has turned on.
   *
   * Never throws. The sweep runs across every shop, and one shop's bad email
   * address must not stop the rest from being reminded.
   *
   * @param force ignores today's log and sends regardless. For the "send me a
   *   test" button, which must work even after the night's reminder went out.
   * @param suppress channels to hold back whatever the shop's preferences say.
   *   For testing only — a repeating test run wants the push without mailing
   *   the shopkeeper a hundred times, and Gmail locks accounts that try.
   *   Suppressing a channel does not touch the stored preference.
   */
  async remindShop(
    shopkeeper: ShopkeeperDocument,
    force = false,
    suppress: ReminderChannel[] = []
  ): Promise<ReminderOutcome> {
    const preferences = notificationsFor(shopkeeper)
    const outcome: ReminderOutcome = {
      shopkeeperId: shopkeeper.shopkeeperId,
      cards: 0,
      // A suppressed channel reports 'off' exactly as a channel the shop turned
      // off does. It did not send, and nothing downstream needs to tell the two
      // apart — only the caller that asked for the suppression does.
      push: preferences.push && !suppress.includes('push') ? 'skipped' : 'off',
      email: preferences.email && !suppress.includes('email') ? 'skipped' : 'off',
      inbox: 'already-sent',
    }

    const digest = await this.buildDigest(shopkeeper)
    if (!digest) return outcome

    outcome.cards = digest.total

    // Written first, and regardless of what the two delivery channels are set
    // to. The in-app list is the record that the reminder happened; a shop with
    // push and email both off still wants to open the bell and see what is due.
    outcome.inbox = await this.recordInbox(digest, force)

    if (preferences.push && !suppress.includes('push')) {
      outcome.push = await this.#sendPush(digest, force)
    }

    if (preferences.email && !suppress.includes('email')) {
      outcome.email = await this.#sendEmail(digest, force)
    }

    return outcome
  }

  /**
   * Writes today's digest into the shop's in-app notification list.
   *
   * Claimed on the 'inbox' channel, so the nightly sweep and someone opening
   * the bell cannot both post the same day twice. Unlike the delivery channels
   * a failure here is not released for retry — the claim and the insert are one
   * step apart against the same database, so there is no partial outcome worth
   * unwinding.
   */
  async recordInbox(digest: ShopDigest, force = false): Promise<ReminderOutcome['inbox']> {
    if (!force && !(await this.#claim(digest.shopkeeperId, 'inbox', digest.total))) {
      return 'already-sent'
    }

    await inbox.add(digest.shopkeeperId, {
      kind: 'reminder',
      title: pushTitle(digest),
      body: pushBody(digest),
      url: '/dashboard',
      counts: {
        expired: digest.expired.length,
        overdue: digest.overdue.length,
        dueToday: digest.dueToday.length,
        dueSoon: digest.dueSoon.length,
        total: digest.total,
      },
    })

    return 'sent'
  }

  /**
   * Makes sure the shop's notification list reflects what is due right now.
   *
   * Called when the notifications page is opened. Without it the list stays
   * empty until the nightly sweep first runs — so a shop that installed the app
   * this morning, with three cards overdue, would tap the bell and be told they
   * have nothing. The claim means opening the page ten times still produces one
   * entry, and the same entry the sweep would have written.
   *
   * Never throws: a failure here must not stop the notification list loading.
   */
  async syncInbox(shopkeeper: ShopkeeperDocument): Promise<void> {
    try {
      const digest = await this.buildDigest(shopkeeper)
      if (!digest) return

      await this.recordInbox(digest)
    } catch (error) {
      logger.error(
        { err: error, shopkeeperId: shopkeeper.shopkeeperId },
        'Could not refresh the notification list'
      )
    }
  }

  async #sendPush(digest: ShopDigest, force: boolean): Promise<ReminderOutcome['push']> {
    if (!force && !(await this.#claim(digest.shopkeeperId, 'push', digest.total))) {
      return 'already-sent'
    }

    const result = await push.sendToShop(digest.shopkeeperId, {
      title: pushTitle(digest),
      body: pushBody(digest),
      url: '/dashboard',
      // One reminder notification per shop in the tray at a time: today's
      // count replaces yesterday's rather than stacking behind it.
      tag: 'due-reminder',
    })

    if (result.sent > 0) return 'sent'

    // No devices and no credentials are both "nothing to send to" rather than
    // failures, and neither is worth retrying later today — the claim stands.
    if (result.skipped) return 'skipped'

    if (!force) await this.#release(digest.shopkeeperId, 'push')
    return 'failed'
  }

  async #sendEmail(digest: ShopDigest, force: boolean): Promise<ReminderOutcome['email']> {
    if (!force && !(await this.#claim(digest.shopkeeperId, 'email', digest.total))) {
      return 'already-sent'
    }

    const mail = renderDueReminder(digest, env.get('WEB_APP_URL').replace(/\/$/, ''))
    const result = await mailer.send({ to: digest.email, ...mail })

    if (result.sent) return 'sent'
    if (result.skipped) return 'skipped'

    if (!force) await this.#release(digest.shopkeeperId, 'email')
    return 'failed'
  }

  /**
   * Reminds every shop that has a channel turned on.
   *
   * Sequential rather than parallel. The point is not speed — this runs once a
   * night against a few hundred shops at most — it is that Resend and FCM both
   * rate-limit, and a burst of parallel sends is the thing that trips them.
   *
   * @param force ignores today's log, so every shop is sent to again. For
   *   testing only — see `remindShop`.
   */
  async runDailySweep(force = false): Promise<ReminderOutcome[]> {
    const register = await shopkeepers.withRemindersEnabled()
    const outcomes: ReminderOutcome[] = []

    for (const shopkeeper of register) {
      try {
        outcomes.push(await this.remindShop(shopkeeper, force))
      } catch (error) {
        // remindShop is written not to throw, so this is a genuine surprise —
        // a database failure mid-run. Logged and stepped over: the shops after
        // this one in the list still need their reminders.
        logger.error(
          { err: error, shopkeeperId: shopkeeper.shopkeeperId },
          'A shop could not be reminded'
        )
      }
    }

    return outcomes
  }

  /** Removes log entries older than `days`. Housekeeping, not correctness. */
  async pruneLog(days = 60): Promise<number> {
    const cutoff = new Date(Date.now() - days * DAY_MS)
    const result = await this.log.deleteMany({ createdAt: { $lt: cutoff } })

    return result.deletedCount
  }

  /** Every reminder log entry for a shop being deleted. Part of the cascade. */
  async deleteForShop(shopkeeperId: string): Promise<number> {
    const result = await this.log.deleteMany({ shopkeeperId })
    return result.deletedCount
  }
}

/** One-line summary for the notification's title. */
function pushTitle(digest: ShopDigest): string {
  // Expired leads, because it is the only bucket nothing can be done about and
  // the only one with a deadline that has already been missed outright.
  if (digest.expired.length > 0) {
    return digest.expired.length === 1
      ? '1 card has expired'
      : `${digest.expired.length} cards have expired`
  }

  if (digest.overdue.length > 0) {
    return digest.overdue.length === 1
      ? '1 card is overdue'
      : `${digest.overdue.length} cards are overdue`
  }

  if (digest.dueToday.length > 0) {
    return digest.dueToday.length === 1 ? '1 card is due today' : `${digest.dueToday.length} cards are due today`
  }

  return digest.total === 1 ? '1 card is due soon' : `${digest.total} cards are due soon`
}

/**
 * The body, which names customers when there are few enough to be useful.
 *
 * A notification that says "3 cards due" makes the shopkeeper open the app to
 * find out who; one that says "Ravi Kumar, Sunita Devi and one more" often
 * answers the question outright. Past three names it stops fitting in a
 * notification and the count is the more useful thing.
 */
function pushBody(digest: ShopDigest): string {
  // Expired first, so the two or three names that fit are the ones nothing can
  // be done about any more. "Renew" is dropped when every card in the digest
  // has expired — none of them can be, and offering it is the notification
  // asking for something the app will refuse.
  const names = namesOf([
    ...digest.expired,
    ...digest.overdue,
    ...digest.dueToday,
    ...digest.dueSoon,
  ])

  const renewable = digest.total - digest.expired.length

  return renewable === 0
    ? `${names} — open manageyourcard to see them.`
    : `${names} — open manageyourcard to renew.`
}

/**
 * Names the first two customers, then counts the rest.
 *
 * Two is the most that fits before a notification truncates on a phone, and a
 * name that gets cut off mid-word is worse than a count. "Ravi, Sunita and 3
 * more" reads cleanly and often answers the question outright, which is the
 * whole point — a notification that only says "5 cards" forces the app open to
 * learn anything at all.
 */
function namesOf(entries: DigestCard[]): string {
  const names = entries.slice(0, 2).map((card) => card.customerName)
  const rest = entries.length - names.length

  return rest > 0 ? `${names.join(', ')} and ${rest} more` : names.join(' and ')
}

export default new Reminders()
