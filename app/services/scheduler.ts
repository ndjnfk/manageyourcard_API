import cards from '#services/cards'
import mailer from '#services/mailer'
import push from '#services/push'
import redis from '#services/redis'
import reminders from '#services/reminders'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import cron, { type RunCoordinator, type ScheduledTask } from 'node-cron'

/**
 * How long an elected instance holds the slot for, in milliseconds.
 *
 * Only read when SCHEDULER_DISTRIBUTED is on. Generous — fifteen minutes rather
 * than node-cron's thirty seconds — because the lease has to outlast the sweep
 * it guards. A lease that expires mid-run leaves the slot free for a second
 * instance whose clock is a minute slow, which is the exact thing it exists to
 * prevent.
 */
const LEASE_MS = 15 * 60 * 1000

/** One job the scheduler owns. `run` returns the line to log when it finishes. */
interface ScheduledJob {
  /** Also the coordination key across instances, so it must be stable. */
  name: string
  cron: string
  description: string
  run: () => Promise<string>
}

/**
 * Elects one instance per scheduled slot when several are running.
 *
 * `SET key 1 PX ttl NX` is the whole election: Redis will only let the key be
 * created once, so of the instances that wake for the same slot exactly one
 * gets 'OK' back and the rest are told to stand down.
 *
 * There is deliberately no `onComplete`. Releasing the key at the end of the
 * run would let an instance that arrived late — a slow boot, a skewed clock —
 * win the same slot and sweep a second time. The lease is meant to expire on
 * its own, not to be handed back.
 */
const redisCoordinator: RunCoordinator = {
  async shouldRun(key: string, ttlMs: number): Promise<boolean> {
    // Namespaced here rather than in the job name, which is also what gets
    // logged: 'cron:reminders:daily:2026-08-01T00:30:00.000Z' is a sensible
    // Redis key, and the log stays readable.
    const claimed = await redis.client.set(`cron:${key}`, '1', 'PX', ttlMs, 'NX')

    return claimed === 'OK'
  },
}

/**
 * The in-process scheduler: the daily reminder sweep, on a timer inside the API.
 *
 * The same work is also an ace command (`node ace reminders:send`), and that is
 * still the right tool for a one-off or for a host that schedules things itself.
 * This exists because the common deployment is a single always-on Node process,
 * where "install a crontab entry as well" is a step that gets forgotten and
 * whose absence looks exactly like working software that never notifies anyone.
 *
 * Running it in-process raises the obvious risk — two web workers behind a load
 * balancer would each wake at 6am and each sweep the register. That is safe
 * rather than merely unlikely: `reminders` claims every shop and channel in a
 * uniquely-indexed collection before sending, so the second sweep finds the day
 * already done and sends nothing. SCHEDULER_DISTRIBUTED stops the duplicated
 * *work* on top of that, but nothing depends on it being switched on.
 */
class Scheduler {
  #tasks: ScheduledTask[] = []

  /**
   * Whether runs ignore the once-a-day guarantee. Resolved once, in `start`.
   *
   * Held on the instance rather than read per run so that the warning about it
   * is printed once on boot, where someone will see it, instead of on every
   * fire — where a repeated line becomes something the eye skips.
   */
  #force = false

  /** On unless switched off, so a fresh deployment notifies people by default. */
  get isEnabled(): boolean {
    return env.get('SCHEDULER_ENABLED') ?? true
  }

  /**
   * Whether every run re-sends, ignoring today's log. **Testing only.**
   *
   * Without it a one-minute cron looks broken: the first run sends, and every
   * run after it correctly finds the day already claimed and sends nothing —
   * which is right in production and useless when you are trying to watch a
   * notification arrive.
   *
   * Refused outright in production. The once-a-day guarantee is the only thing
   * standing between a shopkeeper and a notification every minute, and a flag
   * that can be left on by accident in a deployment is not a flag worth having.
   */
  get isForced(): boolean {
    if (!env.get('SCHEDULER_FORCE')) return false

    if (env.get('NODE_ENV') === 'production') {
      logger.warn('SCHEDULER_FORCE is ignored in production — reminders stay once a day')
      return false
    }

    return true
  }

  /**
   * The zone the cron expressions are read in — Asia/Kolkata unless set.
   *
   * Stated explicitly rather than left to the server's clock. The deployment
   * runs with TZ=UTC, so "0 6 * * *" against local time would fire at 11:30am
   * India time, and the same configuration would mean different things in
   * development and in production.
   */
  get timezone(): string {
    return env.get('SCHEDULER_TIMEZONE')
  }

  /** Whether the slot is claimed in Redis before running. Off by default. */
  get isDistributed(): boolean {
    return env.get('SCHEDULER_DISTRIBUTED') ?? false
  }

  /** Every job, in the order they are registered. */
  get jobs(): ScheduledJob[] {
    const jobs: ScheduledJob[] = [
      {
        name: 'reminders:daily',
        cron: env.get('REMINDER_CRON'),
        description: 'Daily digest — push, email and the in-app list',
        run: () => this.#runDailyDigest(),
      },
    ]

    // Unset means not scheduled, rather than scheduled at some default hour.
    // The end-of-day nudge is a choice about how much a shop hears from us, and
    // switching it on should be a decision someone made.
    const dueTodayCron = env.get('DUE_TODAY_CRON')

    if (dueTodayCron) {
      jobs.push({
        name: 'reminders:due-today',
        cron: dueTodayCron,
        description: 'End-of-day alert — push and the in-app list only',
        run: () => this.#runDueToday(),
      })
    }

    // Unset means never, and that is the right default for a job that destroys
    // records. Switching it on has to be somebody's decision, taken once, in
    // writing — not something that arrives with a deployment.
    const purgeCron = env.get('CARD_PURGE_CRON')

    if (purgeCron) {
      jobs.push({
        name: 'cards:purge',
        cron: purgeCron,
        description: 'Delete cards that have served their days on the history page',
        run: () => this.#runPurge(),
      })
    }

    return jobs
  }

  /**
   * Registers the timers. Called once, on boot, by the scheduler provider.
   *
   * Idempotent: a second call with tasks already registered does nothing rather
   * than scheduling everything twice.
   */
  start(): void {
    if (!this.isEnabled) {
      logger.info('Scheduler is off (SCHEDULER_ENABLED=false) — no reminders will be sent')
      return
    }

    if (this.#tasks.length > 0) return

    this.#force = this.isForced

    if (this.#force) {
      // Loud, and worth being loud about: with a short cron this mails the
      // shopkeeper on every fire. Gmail throttles and then locks an account
      // that sends like a mailing list, which costs the install its email
      // channel until Google is done being suspicious.
      logger.warn(
        'SCHEDULER_FORCE is on — every run re-sends, ignoring the once-a-day guarantee. ' +
          'Testing only: a short REMINDER_CRON will email on every fire.'
      )
    }

    // Said on boot rather than discovered at 6am. An install with no Firebase
    // and no mail transport schedules and runs perfectly while delivering
    // nothing, and silence at dawn is the hardest failure to notice.
    if (!push.isConfigured) {
      logger.warn('Firebase is not configured — scheduled reminders will not push')
    }
    if (!mailer.isConfigured) {
      logger.warn('No mail transport is configured — scheduled reminders will not email')
    }

    // node-cron's own warnings — a missed slot, an overlapping run — go through
    // the app's logger, so they land in the same place as everything else
    // rather than on a stdout nobody is reading.
    cron.setLogger({
      info: (message) => logger.info(message),
      warn: (message) => logger.warn(message),
      error: (message, error) => logger.error({ err: error }, String(message)),
      debug: (message) => logger.debug(String(message)),
    })

    for (const job of this.jobs) {
      this.#schedule(job)
    }
  }

  /** Cancels every timer. Called on shutdown so the process can exit. */
  async stop(): Promise<void> {
    for (const task of this.#tasks) {
      await task.destroy()
    }

    this.#tasks = []
  }

  #schedule(job: ScheduledJob): void {
    const task = cron.schedule(job.cron, () => this.#run(job), {
      name: job.name,
      timezone: this.timezone,
      // A sweep that overruns its next slot must not be joined by a second
      // copy of itself. Nothing would be sent twice — the claim in
      // `reminders` sees to that — but the two would contend over the same
      // shops and the same rate limits for no gain.
      noOverlap: true,
      ...(this.isDistributed
        ? { distributed: true, runCoordinator: redisCoordinator, distributedLease: LEASE_MS }
        : {}),
    })

    this.#tasks.push(task)

    // The next fire time, not just the expression. "0 6 * * *" is easy to
    // misread; a timestamp on the boot line is checkable at a glance, and it
    // is how you catch a timezone that isn't what you assumed.
    logger.info(
      `Scheduled ${job.name} — ${job.cron} · next run ${this.#describe(task.getNextRun())}`
    )
  }

  /**
   * A fire time in the scheduler's own zone, with the UTC instant beside it.
   *
   * Both, because the process logs in UTC — the deployment runs `TZ=UTC` so
   * that a stored date is the same date everywhere — while the schedule is
   * written in India time. A job set for 6am therefore appears in the log as
   * 00:30, which is correct and looks like a mistake. Printing the pair turns
   * "is that the right time?" from arithmetic into reading.
   */
  #describe(date: Date | null): string {
    if (!date) return 'unknown'

    const local = DateTime.fromJSDate(date).setZone(this.timezone)

    return (
      `${local.toFormat('dd LLL yyyy, h:mm a')} ${this.timezone} ` +
      `(${local.toUTC().toFormat('HH:mm')} UTC — what this log prints)`
    )
  }

  /**
   * Runs one job, timing it and swallowing whatever it throws.
   *
   * A scheduled job that throws must not take the timer down with it: tomorrow
   * morning's reminders should not depend on this morning's having succeeded.
   */
  async #run(job: ScheduledJob): Promise<void> {
    const startedAt = Date.now()
    logger.info(`${job.name} started — ${job.description}`)

    try {
      const summary = await job.run()
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)

      logger.info(`${job.name} finished in ${seconds}s — ${summary}`)
    } catch (error) {
      logger.error({ err: error }, `${job.name} failed`)
    }
  }

  /** The 6am digest, across every shop that has reminders on. */
  async #runDailyDigest(): Promise<string> {
    const outcomes = await reminders.runDailySweep(this.#force)
    const due = outcomes.filter((outcome) => outcome.cards > 0)
    const pushed = due.filter((outcome) => outcome.push === 'sent').length
    const mailed = due.filter((outcome) => outcome.email === 'sent').length
    const filed = due.filter((outcome) => outcome.inbox === 'sent').length

    return (
      `${outcomes.length} shop(s) checked, ${due.length} with cards due · ` +
      `${pushed} pushed · ${mailed} emailed · ${filed} filed in-app`
    )
  }

  /**
   * Deletes cards whose four days on the history page are up.
   *
   * The count is logged even when it is zero, and named as a deletion rather
   * than a tidy-up. This is the only scheduled job that destroys anything, and
   * the log line is the only record that will exist afterwards that it ran.
   */
  async #runPurge(): Promise<string> {
    const deleted = await cards.purgeHistory()

    if (deleted > 0) {
      logger.warn(`cards:purge deleted ${deleted} card(s) permanently`)
    }

    return `${deleted} card(s) deleted`
  }

  /** The optional end-of-day nudge about cards still open. */
  async #runDueToday(): Promise<string> {
    const outcomes = await reminders.runDueTodaySweep(this.#force)
    const alerted = outcomes.filter((outcome) => outcome.outcome === 'sent').length

    return `${outcomes.length} shop(s) checked, ${alerted} alerted`
  }
}

export default new Scheduler()
