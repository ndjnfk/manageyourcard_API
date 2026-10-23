import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Deletes cards whose four days on the history page are up.
 *
 *   node ace cards:purge --dry-run
 *   node ace cards:purge --confirm
 *
 * The same work the `cards:purge` scheduled job does, runnable by hand — and
 * the only way to see what that job *would* do before switching it on.
 *
 * **Nothing recovers what this deletes.** The document goes, and with it the
 * customer's name and number, every date on the card, and its renewal history.
 * A card removed here cannot later answer "has this customer been in before?",
 * because there is nothing left to ask.
 *
 * Hence `--confirm`. A destructive command whose default is to destroy is one
 * tab-completion away from an accident, so the default here is to report and
 * the deletion has to be asked for in as many words.
 */
export default class PurgeCards extends BaseCommand {
  static commandName = 'cards:purge'
  static description = 'Delete cards that have served their days on the history page'

  /** MongoDB is opened by a provider, so the app has to boot. */
  static options: CommandOptions = { startApp: true }

  @flags.boolean({
    description: 'List what would be deleted without deleting anything',
    default: false,
  })
  declare dryRun: boolean

  @flags.boolean({
    description: 'Actually delete. Without it the command only reports.',
    default: false,
  })
  declare confirm: boolean

  async run() {
    const { default: cards } = await import('#services/cards')

    const doomed = await cards.purgeCandidates()

    if (doomed.length === 0) {
      this.logger.info('Nothing has finished its time on the history page.')
      return
    }

    const table = this.ui.table()
    table.head(['Shop', 'Card', 'Customer', 'Due', 'Expiry', 'Completed'])

    for (const card of doomed) {
      table.row([
        card.shopkeeperId,
        card.cardNumber,
        card.customerName,
        card.dueDate.toISOString().slice(0, 10),
        card.expiryDate ? card.expiryDate.toISOString().slice(0, 10) : '—',
        card.completedAt ? card.completedAt.toISOString().slice(0, 10) : '—',
      ])
    }

    table.render()

    if (this.dryRun || !this.confirm) {
      this.logger.info(
        `${doomed.length} card(s) are due for deletion. ` +
          'Nothing was deleted — pass --confirm to go ahead.'
      )
      return
    }

    const deleted = await cards.purgeHistory()

    // Warning, not success. Deleting records is not an achievement to be
    // reported in green, and this line is the only trace that will remain.
    this.logger.warning(`${deleted} card(s) deleted permanently.`)
  }
}
