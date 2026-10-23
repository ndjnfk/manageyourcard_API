import type { DigestCard, ShopDigest } from '#services/reminders'

/**
 * The daily reminder email.
 *
 * Written as inline-styled tables rather than with a stylesheet, and rendered
 * from strings rather than through a template engine. Both are deliberate:
 * email clients strip <style> blocks and ignore flexbox, grid and CSS
 * variables, so the only styling that survives Gmail and Outlook is inline
 * attributes on table cells. The app's own palette is reproduced here as
 * literal hex, since `var(--myc-violet)` means nothing in an inbox.
 */

/** The palette, mirrored from the app's _theme.scss as literals. */
const COLOR = {
  bg: '#0a0518',
  raised: '#140b2e',
  border: 'rgba(255,255,255,0.12)',
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.64)',
  faint: 'rgba(255,255,255,0.38)',
  violet: '#7b2ff7',
  magenta: '#c13af5',
  red: '#ff4d6d',
  amber: '#f5a623',
  cyan: '#35d6f0',
} as const

/** What one email needs, minus the address it goes to. */
export interface RenderedMail {
  subject: string
  html: string
  text: string
}

/** Escapes text that goes into HTML. Customer names are user input. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** "12 Aug 2026" — read more easily at a glance than 2026-08-12. */
function readableDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "3 days overdue", "due today", "in 5 days". */
function whenText(card: DigestCard): string {
  if (card.daysUntilDue < 0) {
    const days = Math.abs(card.daysUntilDue)
    return days === 1 ? '1 day overdue' : `${days} days overdue`
  }

  if (card.daysUntilDue === 0) return 'due today'

  return card.daysUntilDue === 1 ? 'tomorrow' : `in ${card.daysUntilDue} days`
}

/**
 * The subject line.
 *
 * Leads with the most urgent bucket and names a number, because the subject is
 * often all that gets read — in a notification shade, in a preview pane, in a
 * list of thirty unread. "Reminder from manageyourcard" would say nothing.
 */
function subjectFor(digest: ShopDigest): string {
  // Expired leads, for the same reason it leads the push: it is the one state
  // nothing can be done about, and burying it under "due soon" told the shop
  // to renew a card the app itself would refuse to renew.
  if (digest.expired.length > 0) {
    const count = digest.expired.length
    return `${count} ${count === 1 ? 'card has' : 'cards have'} expired — ${digest.shopName}`
  }

  if (digest.overdue.length > 0) {
    const count = digest.overdue.length
    return `${count} ${count === 1 ? 'card is' : 'cards are'} overdue — ${digest.shopName}`
  }

  if (digest.dueToday.length > 0) {
    const count = digest.dueToday.length
    return `${count} ${count === 1 ? 'card is' : 'cards are'} due today — ${digest.shopName}`
  }

  return `${digest.total} ${digest.total === 1 ? 'card' : 'cards'} due soon — ${digest.shopName}`
}

/** One row of the card table. */
function rowHtml(card: DigestCard, accent: string): string {
  return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid ${COLOR.border};">
        <div style="font:600 15px/1.4 -apple-system,'Segoe UI',Roboto,sans-serif;color:${COLOR.text};">
          ${escapeHtml(card.customerName)}
        </div>
        <div style="font:400 13px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:${COLOR.faint};">
          ${escapeHtml(card.cardNumber)} &middot; ${escapeHtml(card.customerMobile)}
        </div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid ${COLOR.border};text-align:right;white-space:nowrap;">
        <div style="font:600 14px/1.4 -apple-system,'Segoe UI',Roboto,sans-serif;color:${accent};">
          ${whenText(card)}
        </div>
        <div style="font:400 13px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:${COLOR.faint};">
          ${readableDate(card.dueDate)}
        </div>
      </td>
    </tr>`
}

/** A titled block of rows, or nothing when the bucket is empty. */
function sectionHtml(title: string, entries: DigestCard[], accent: string): string {
  if (entries.length === 0) return ''

  return `
    <tr><td style="padding:24px 0 8px;">
      <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${accent}1f;color:${accent};font:700 12px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;letter-spacing:0.04em;text-transform:uppercase;">
        ${title} &middot; ${entries.length}
      </span>
    </td></tr>
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:${COLOR.raised};border:1px solid ${COLOR.border};border-radius:16px;overflow:hidden;">
        ${entries.map((card) => rowHtml(card, accent)).join('')}
      </table>
    </td></tr>`
}

/** The plain-text alternative. Same information, no markup. */
function textFor(digest: ShopDigest, webUrl: string): string {
  const block = (title: string, entries: DigestCard[]): string => {
    if (entries.length === 0) return ''

    const lines = entries.map(
      (card) =>
        `  - ${card.customerName} (${card.cardNumber}, ${card.customerMobile}) — ${whenText(card)}, ${readableDate(card.dueDate)}`
    )

    return `\n${title.toUpperCase()} (${entries.length})\n${lines.join('\n')}\n`
  }

  return [
    `Hello ${digest.ownerName},`,
    ``,
    `${digest.total} ${digest.total === 1 ? 'card needs' : 'cards need'} your attention at ${digest.shopName}.`,
    block('Expired', digest.expired),
    block('Overdue', digest.overdue),
    block('Due today', digest.dueToday),
    block('Due soon', digest.dueSoon),
    ``,
    `Open your dashboard: ${webUrl}/dashboard`,
    ``,
    `— manageyourcard`,
    `You can turn these reminders off in your profile settings: ${webUrl}/profile`,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

/**
 * Builds the reminder email for one shop's digest.
 *
 * @param webUrl the browser app's origin, with no trailing slash. Passed in
 *   rather than read from the environment here so this stays a pure function of
 *   its inputs — which is what makes it testable without a configured app.
 */
export function renderDueReminder(digest: ShopDigest, webUrl: string): RenderedMail {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subjectFor(digest))}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};">
  <!-- Shown in the inbox list under the subject. Hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${digest.expired.length} expired, ${digest.overdue.length} overdue, ${digest.dueToday.length} due today, ${digest.dueSoon.length} due soon.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${COLOR.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">

        <tr><td style="padding-bottom:8px;">
          <span style="font:700 20px/1.3 'Playfair Display',Georgia,serif;background:linear-gradient(90deg,#ffffff,#d8b4fe);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:${COLOR.text};">
            manageyourcard
          </span>
        </td></tr>

        <tr><td style="padding-bottom:4px;">
          <h1 style="margin:0;font:700 24px/1.3 -apple-system,'Segoe UI',Roboto,sans-serif;color:${COLOR.text};">
            Hello ${escapeHtml(digest.ownerName)}
          </h1>
        </td></tr>

        <tr><td>
          <p style="margin:0;font:400 15px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;color:${COLOR.muted};">
            ${digest.total} ${digest.total === 1 ? 'card needs' : 'cards need'} your attention at
            <strong style="color:${COLOR.text};">${escapeHtml(digest.shopName)}</strong>.
          </p>
        </td></tr>

        <!-- Muted, not red. Red is spent on the cards still worth chasing; an
             expired one is finished, and giving it the loudest colour teaches
             the eye to ignore the colour. -->
        ${sectionHtml('Expired', digest.expired, COLOR.muted)}
        ${sectionHtml('Overdue', digest.overdue, COLOR.red)}
        ${sectionHtml('Due today', digest.dueToday, COLOR.amber)}
        ${sectionHtml('Due soon', digest.dueSoon, COLOR.cyan)}

        <tr><td style="padding:28px 0 8px;">
          <!-- Table-wrapped so the button keeps its shape in Outlook, which
               ignores padding on an inline <a>. -->
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="border-radius:999px;background:linear-gradient(135deg,${COLOR.magenta},${COLOR.violet});">
              <a href="${webUrl}/dashboard"
                 style="display:inline-block;padding:14px 28px;font:600 15px/1 -apple-system,'Segoe UI',Roboto,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px;">
                Open my dashboard
              </a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding-top:28px;border-top:1px solid ${COLOR.border};">
          <p style="margin:0;font:400 13px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;color:${COLOR.faint};">
            You are getting this because reminders are switched on for your shop.
            <a href="${webUrl}/profile" style="color:${COLOR.muted};">Turn them off</a> any time.
          </p>
          <p style="margin:8px 0 0;font:400 13px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;color:${COLOR.faint};">
            manageyourcard tracks renewal dates only — never card numbers or payments.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject: subjectFor(digest), html, text: textFor(digest, webUrl) }
}
