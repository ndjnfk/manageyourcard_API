/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'
import { validate as isCronExpression } from 'node-cron'

/**
 * A cron expression, checked here rather than where it is scheduled.
 *
 * A typo in one of these is a config mistake, and the cost of finding it late
 * is a morning with no reminders — so it stops the boot with the variable's
 * name in the message, instead of throwing hours later inside the scheduler.
 */
function cronExpression(fallback: string): (key: string, value?: string) => string
function cronExpression(): (key: string, value?: string) => string | undefined
function cronExpression(fallback?: string) {
  return (key: string, value?: string) => {
    const expression = value?.trim() || fallback

    if (!expression) return undefined

    if (!isCronExpression(expression)) {
      throw new Error(`Invalid ${key}: "${expression}" is not a cron expression`)
    }

    return expression
  }
}

/** An IANA zone name, checked the only way there is — by asking Intl. */
function timezone(fallback: string) {
  return (key: string, value?: string) => {
    const zone = value?.trim() || fallback

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone })
    } catch {
      throw new Error(`Invalid ${key}: "${zone}" is not a timezone, e.g. Asia/Kolkata`)
    }

    return zone
  }
}

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // MongoDB — the shopkeeper register (collection: users)
  MONGO_URI: Env.schema.string(),
  MONGO_DB_NAME: Env.schema.string(),

  // Redis — holds signed-in sessions. They are stored without an expiry, so
  // this is durable state: losing it signs every shopkeeper out.
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),
  /**
   * Which Redis database to use. Defaults to 0.
   *
   * Worth setting when more than one environment shares a Redis server: the
   * admin panel's "clear Redis" empties the database it is pointed at, and a
   * staging deployment should not be able to sign out production.
   */
  REDIS_DB: Env.schema.number.optional(),

  // Comma-separated list of browser origins allowed to call this API.
  // Optional: when unset, development allows any origin and production none.
  CORS_ORIGIN: Env.schema.string.optional(),

  /*
  |--------------------------------------------------------------------------
  | Where the browser app lives
  |--------------------------------------------------------------------------
  |
  | APP_URL is this API. This is the Angular app — where a notification should
  | send someone when they tap it, and what the links in a reminder email point
  | at. They are different origins in development and usually in production
  | too, so a notification built from APP_URL would land on a JSON endpoint.
  */
  WEB_APP_URL: Env.schema.string({ format: 'url', tld: false }),

  /*
  |--------------------------------------------------------------------------
  | Firebase Cloud Messaging
  |--------------------------------------------------------------------------
  |
  | The three fields lifted out of the service account JSON. Kept as separate
  | variables rather than a path to the file so that a deployment can set them
  | as environment variables — the file is a secret, and a secret that has to
  | be checked in to be deployed does not stay one.
  |
  | All optional: an install without them simply cannot send push, which the
  | push service reports. Requiring them would mean nobody can run the app at
  | all until a Firebase project exists.
  */
  FIREBASE_PROJECT_ID: Env.schema.string.optional(),
  FIREBASE_CLIENT_EMAIL: Env.schema.string.optional(),
  /**
   * The `private_key` from the service account JSON, quoted.
   *
   * It contains real newlines, which no .env file can carry, so it is stored
   * with literal `\n` sequences and unescaped when Firebase is initialised.
   */
  FIREBASE_PRIVATE_KEY: Env.schema.string.optional(),

  /*
  |--------------------------------------------------------------------------
  | Email
  |--------------------------------------------------------------------------
  |
  | Two transports are supported and the mailer picks between them by what is
  | filled in: Resend if it has an API key, otherwise SMTP. Neither configured
  | means no email is sent, which is a normal state rather than an error.
  |
  | SMTP is what this install uses — it needs no signup, and works with a Gmail
  | app password. Its ceiling is low (Gmail allows roughly 500 recipients a day
  | and will throttle or lock an account that looks like a mailing list), so a
  | deployment with real shops on it wants Resend or another transactional
  | provider instead. Swapping is a matter of filling in RESEND_API_KEY.
  |
  | The from-address is not free-form on either transport. Gmail rewrites a
  | From it does not recognise back to the authenticated account, so with SMTP
  | this should be the same address as SMTP_USERNAME. On Resend it has to be a
  | domain verified with them.
  */
  RESEND_API_KEY: Env.schema.string.optional(),
  MAIL_FROM_ADDRESS: Env.schema.string.optional(),
  MAIL_FROM_NAME: Env.schema.string.optional(),

  /**
   * SMTP. Used when RESEND_API_KEY is absent.
   *
   * SMTP_PASSWORD for Gmail is an app password, not the account password —
   * Google stopped accepting the latter over SMTP. It is generated at
   * myaccount.google.com → Security → 2-Step Verification → App passwords,
   * and 2FA has to be on for that option to exist at all.
   */
  SMTP_HOST: Env.schema.string.optional(),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.string.optional(),

  /*
  |--------------------------------------------------------------------------
  | Reminders
  |--------------------------------------------------------------------------
  |
  | How many days ahead of a due date to start reminding. Matches the
  | dashboard's "Due Soon" window by default, so what a shopkeeper is told
  | about is exactly what the badge on the card already says.
  */
  REMINDER_LEAD_DAYS: Env.schema.number.optional(),

  /*
  |--------------------------------------------------------------------------
  | The scheduler
  |--------------------------------------------------------------------------
  |
  | The reminder sweep runs on a timer inside this process. The same work is
  | also `node ace reminders:send`, which is still what a host that schedules
  | things itself — a crontab, Windows Task Scheduler — should call. The
  | in-process timer exists so that a plain `node bin/server.js` deployment
  | notifies people without a second thing having to be set up.
  |
  | Set SCHEDULER_ENABLED=false where the host already schedules the command,
  | so the reminders do not have two owners.
  */
  SCHEDULER_ENABLED: Env.schema.boolean.optional(),

  /**
   * The zone the expressions below are read in.
   *
   * Not the server's clock, which is UTC: "0 6 * * *" against UTC would fire at
   * half past eleven in the morning in India, and the same setting would mean
   * different times in development and production.
   */
  SCHEDULER_TIMEZONE: timezone('Asia/Kolkata'),

  /** When the daily digest goes out — push, email and the in-app list. */
  REMINDER_CRON: cronExpression('0 6 * * *'),

  /**
   * When the end-of-day "still open today" alert goes out, e.g. `30 17 * * *`.
   *
   * Unset means it is not scheduled at all. How much a shop hears from us in a
   * day should be a decision someone made, not a default that arrived with an
   * upgrade.
   */
  DUE_TODAY_CRON: cronExpression(),

  /**
   * Claim each run in Redis before sweeping, so only one instance does it.
   *
   * For deployments running more than one copy of the API. Off by default and
   * not required for correctness: reminders are claimed per shop, per channel,
   * per day in MongoDB before anything is sent, so a second instance sweeping
   * the same morning sends nothing. This only saves the wasted sweep.
   */
  SCHEDULER_DISTRIBUTED: Env.schema.boolean.optional(),

  /**
   * Re-send on every run, ignoring the once-a-day log. **Testing only.**
   *
   * Pair it with a short REMINDER_CRON to watch notifications arrive. Ignored
   * in production, where the once-a-day guarantee is the only thing between a
   * shopkeeper and a notification every minute.
   *
   * Note what it costs: with SMTP against Gmail, a one-minute cron sends the
   * shopkeeper a mail a minute, and Google throttles and then locks accounts
   * that behave like that.
   */
  SCHEDULER_FORCE: Env.schema.boolean.optional(),

  /**
   * When to delete cards that have served their four days on the history page,
   * e.g. `30 3 * * *`. **Unset means never, which is the default.**
   *
   * This job destroys records permanently — customer name, number, dates,
   * renewal count. There is no undo and no archive. It is opt-in for that
   * reason: a scheduled deletion should be something somebody switched on, not
   * something that started happening after an upgrade.
   *
   * Check what it would take first, with `node ace cards:purge --dry-run`.
   */
  CARD_PURGE_CRON: cronExpression(),
})
