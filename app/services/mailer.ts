import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import type { Transporter } from 'nodemailer'
import { Resend } from 'resend'

/** One email to send. */
export interface OutgoingMail {
  to: string
  subject: string
  html: string
  /**
   * The plain-text alternative.
   *
   * Not optional. A mail with no text part scores markedly worse with spam
   * filters, and this mail's whole job is to arrive — a reminder in the junk
   * folder is a reminder that did not happen.
   */
  text: string
}

/** What a send did. Callers log it; none of them can usefully retry. */
export interface MailResult {
  sent: boolean
  /** The provider's ID for the message, for tracing a delivery. */
  id?: string
  error?: string
  skipped?: 'not-configured'
}

/** Which transport is in use, for the log line and the settings endpoint. */
export type MailTransport = 'resend' | 'smtp' | 'none'

/**
 * Outgoing email.
 *
 * Two transports, chosen by what is configured rather than by a flag: Resend
 * when it has an API key, otherwise SMTP. That ordering is deliberate — a
 * deployment that has gone to the trouble of setting up Resend means to use it,
 * and leaving stale SMTP credentials in the environment should not quietly
 * override that.
 *
 * Same contract as the push service: lazily built, tolerant of being
 * unconfigured, and never throws. A reminder email that fails must not take
 * down the nightly sweep that was sending it — the other shops still need
 * theirs.
 */
class Mailer {
  #resend: Resend | null = null
  #smtp: Transporter | null = null
  #initialised = false

  /** Which transport will be used. 'none' when neither is configured. */
  get transport(): MailTransport {
    if (env.get('RESEND_API_KEY')) return 'resend'
    if (env.get('SMTP_HOST')) return 'smtp'

    return 'none'
  }

  /**
   * Whether email can be sent at all.
   *
   * A from-address is required either way. Without one nodemailer sends a
   * message with no From header, which every receiving server rejects — a
   * failure that looks like a broken mailbox rather than missing config.
   */
  get isConfigured(): boolean {
    return this.transport !== 'none' && Boolean(env.get('MAIL_FROM_ADDRESS'))
  }

  /** The from-header, as "Name <address>" when a name is configured. */
  get from(): string {
    const address = env.get('MAIL_FROM_ADDRESS')!
    const name = env.get('MAIL_FROM_NAME')

    return name ? `${name} <${address}>` : address
  }

  /**
   * Builds whichever client the configuration calls for, once.
   *
   * `#initialised` makes a failure sticky. Without it a bad SMTP host would be
   * re-resolved and re-logged on every single reminder in the nightly sweep.
   */
  async #connect(): Promise<void> {
    if (this.#initialised) return
    this.#initialised = true

    if (!this.isConfigured) return

    try {
      if (this.transport === 'resend') {
        this.#resend = new Resend(env.get('RESEND_API_KEY'))
        return
      }

      const port = env.get('SMTP_PORT') ?? 587
      const user = env.get('SMTP_USERNAME')
      const pass = env.get('SMTP_PASSWORD')

      // Imported here rather than at module scope so an install using Resend —
      // or no email at all — does not pay to load it.
      const nodemailer = await import('nodemailer')

      this.#smtp = nodemailer.createTransport({
        host: env.get('SMTP_HOST'),
        port,
        /**
         * `secure` means "wrap the whole connection in TLS from the start",
         * which is port 465 only. On 587 — what Gmail and most providers
         * document — the connection opens in the clear and is upgraded by
         * STARTTLS, so `secure` must be false there or the handshake hangs
         * until it times out. Deriving it from the port rather than asking for
         * it removes the commonest way to misconfigure SMTP.
         */
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      })
    } catch (error) {
      logger.error({ err: error }, 'The mail transport could not be created — email is disabled')
      this.#resend = null
      this.#smtp = null
    }
  }

  /**
   * Verifies the transport can actually connect and authenticate.
   *
   * Worth having as its own step because SMTP fails late otherwise: bad
   * credentials are only reported when the first message is sent, which during
   * a nightly sweep means finding out at 6am with nobody watching. `ace
   * reminders:send` calls this so a misconfiguration is a startup error.
   */
  async verify(): Promise<{ ok: boolean; error?: string }> {
    await this.#connect()

    if (!this.isConfigured) return { ok: false, error: 'not configured' }
    // Resend has no connection to verify — it is one HTTPS call per message,
    // and an invalid key is only discovered by making one.
    if (!this.#smtp) return { ok: true }

    try {
      await this.#smtp.verify()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** Sends one email. Never throws; failures come back in the result. */
  async send(mail: OutgoingMail): Promise<MailResult> {
    await this.#connect()

    if (!this.isConfigured) return { sent: false, skipped: 'not-configured' }

    try {
      if (this.#resend) {
        // Resend reports refusals in the body rather than by rejecting — an
        // unverified from-domain comes back as `error`, not as a thrown
        // exception. Checking only for a throw would report those as sent.
        const { data, error } = await this.#resend.emails.send({
          from: this.from,
          to: mail.to,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        })

        if (error) {
          logger.warn({ to: mail.to, err: error.message }, 'Resend refused an email')
          return { sent: false, error: error.message }
        }

        return { sent: true, id: data?.id }
      }

      if (!this.#smtp) return { sent: false, skipped: 'not-configured' }

      const info = await this.#smtp.sendMail({
        from: this.from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      })

      // A server can accept a message for some recipients and reject it for
      // others. Reporting that as sent would hide a bounce that never reached
      // anyone.
      if (info.rejected?.length > 0) {
        logger.warn({ to: mail.to, rejected: info.rejected }, 'SMTP rejected a recipient')
        return { sent: false, error: `Rejected: ${info.rejected.join(', ')}` }
      }

      return { sent: true, id: info.messageId }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error({ err: message, to: mail.to, transport: this.transport }, 'Could not send email')

      return { sent: false, error: message }
    }
  }
}

export default new Mailer()
