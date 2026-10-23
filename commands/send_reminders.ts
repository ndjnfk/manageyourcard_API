import type Reminders from '#services/reminders'
import type { ReminderChannel } from '#services/reminders'
import type { ShopkeeperDocument } from '#services/shopkeepers'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Sends the daily due-date reminders.
 *
 *   node ace reminders:send
 *   node ace reminders:send --shop=SHP-00001 --force
 *   node ace reminders:send --dry-run
 *
 * Meant to be run once a day by whatever schedules things on the host — cron,
 * a platform's scheduler, Windows Task Scheduler. A command rather than a timer
 * inside the server process, because a timer would fire once per running
 * instance: two web workers behind a load balancer would each send the night's
 * reminders, and every shopkeeper would get two of everything.
 *
 * Safe to run more than once a day. Each shop and channel is claimed in the
 * notification log before sending, so a second run finds the day already done
 * and sends nothing — which is what makes a retry after a failed cron harmless.
 *
 * A suggested crontab entry, 8am India time:
 *
 *   30 2 * * *  cd /srv/manageYourCardAPI && node ace reminders:send >> logs/reminders.log 2>&1
 *
 * (2:30 UTC, because the server runs with TZ=UTC.)
 */
export default class SendReminders extends BaseCommand {
  static commandName = 'reminders:send'
  static description = 'Send due-date reminders by push and email to every shop that wants them'

  /** The app has to boot: MongoDB is opened by a provider, not on first use. */
  static options: CommandOptions = { startApp: true }

  @flags.string({
    description: 'Only remind this one shop, e.g. SHP-00001. For testing.',
  })
  declare shop: string

  @flags.boolean({
    description: 'Send even if today’s reminder has already gone out',
    default: false,
  })
  declare force: boolean

  @flags.boolean({
    description: 'Report what would be sent without sending anything',
    default: false,
  })
  declare dryRun: boolean

  @flags.boolean({
    description:
      'Send the end-of-day “still open today” alert instead of the daily digest. Schedule this for late afternoon.',
    default: false,
  })
  declare dueToday: boolean

  /**
   * Named `skipEmail`, not `noEmail`. Ace reads a `--no-` prefix as the
   * negation of a boolean flag, so `--no-email` is parsed as `--email=false`
   * and rejected as an unknown flag.
   */
  @flags.boolean({
    description:
      'Send push and the in-app list, but no email. For repeated testing — Gmail locks accounts that send too often.',
    default: false,
  })
  declare skipEmail: boolean

  async run() {
    const { default: reminders } = await import('#services/reminders')
    const { default: shopkeepers } = await import('#services/shopkeepers')
    const { default: push } = await import('#services/push')
    const { default: mailer } = await import('#services/mailer')

    // Said plainly and up front. The commonest way for this command to appear
    // broken is to run perfectly against an install with no credentials, and a
    // silent success there is far worse than a loud warning.
    if (!push.isConfigured) {
      this.logger.warning('Firebase is not configured — no push will be sent')
    }
    if (!mailer.isConfigured) {
      this.logger.warning('No mail transport is configured — no email will be sent')
    } else {
      // Checked before the sweep rather than discovered during it. SMTP only
      // reports bad credentials when the first message goes out, and at 6am
      // with nobody watching that surfaces as silence rather than an error.
      const check = await mailer.verify()

      if (check.ok) {
        this.logger.info(`Email via ${mailer.transport} as ${mailer.from}`)
      } else {
        this.logger.warning(`Mail transport (${mailer.transport}) failed: ${check.error}`)
      }
    }

    const register = this.shop
      ? [await shopkeepers.findByShopkeeperId(this.shop)].filter(
          (found): found is NonNullable<typeof found> => found !== null
        )
      : await shopkeepers.withRemindersEnabled()

    if (this.shop && register.length === 0) {
      this.logger.error(`No shop with ID ${this.shop}`)
      this.exitCode = 1
      return
    }

    if (this.dryRun) {
      return this.#report(register, reminders)
    }

    if (this.dueToday) {
      return this.#sendDueToday(register, reminders)
    }

    let pushed = 0
    let mailed = 0
    let skipped = 0

    // Held back at the point of sending rather than by blanking SMTP_HOST in
    // the environment. AdonisJS reads its .env file regardless of what the
    // process environment says, so an env override looks like it worked and
    // quietly mails everyone anyway.
    const suppress: ReminderChannel[] = this.skipEmail ? ['email'] : []

    for (const shopkeeper of register) {
      const outcome = await reminders.remindShop(shopkeeper, this.force, suppress)

      if (outcome.cards === 0) {
        skipped++
        continue
      }

      if (outcome.push === 'sent') pushed++
      if (outcome.email === 'sent') mailed++

      this.logger.info(
        `${shopkeeper.shopkeeperId} · ${outcome.cards} card(s) · push: ${outcome.push} · email: ${outcome.email}`
      )
    }

    this.logger.success(
      `Done. ${register.length} shop(s) checked, ${skipped} with nothing due, ` +
        `${pushed} pushed, ${mailed} emailed.`
    )
  }

  /**
   * --due-today: the end-of-day nudge about cards that fell due today and are
   * still open. Meant for a late-afternoon schedule, hours after the digest.
   */
  async #sendDueToday(register: ShopkeeperDocument[], reminders: typeof Reminders) {
    let sent = 0
    let quiet = 0

    for (const shopkeeper of register) {
      const outcome = await reminders.remindDueToday(shopkeeper, this.force)

      if (outcome === 'nothing-due') {
        quiet++
        continue
      }

      if (outcome === 'sent') sent++
      this.logger.info(`${shopkeeper.shopkeeperId} · still-open alert: ${outcome}`)
    }

    this.logger.success(
      `Done. ${register.length} shop(s) checked, ${quiet} with nothing open, ${sent} alerted.`
    )
  }

  /** --dry-run: what each shop would be told, without telling them. */
  async #report(register: ShopkeeperDocument[], reminders: typeof Reminders) {
    const rows: string[][] = []

    for (const shopkeeper of register) {
      const digest = await reminders.buildDigest(shopkeeper)
      if (!digest) continue

      rows.push([
        shopkeeper.shopkeeperId,
        shopkeeper.shopName,
        String(digest.expired.length),
        String(digest.overdue.length),
        String(digest.dueToday.length),
        String(digest.dueSoon.length),
      ])
    }

    if (rows.length === 0) {
      this.logger.info('Nothing is due — no reminders would be sent.')
      return
    }

    const table = this.ui.table()
    table.head(['Shop', 'Name', 'Expired', 'Overdue', 'Today', 'Soon'])
    rows.forEach((row) => table.row(row))
    table.render()

    this.logger.info(`${rows.length} shop(s) would be reminded. Nothing was sent (--dry-run).`)
  }
}
