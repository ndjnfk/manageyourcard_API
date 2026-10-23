import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Starts and stops the reminder timers with the server.
 *
 * Registered for the `web` environment only — see adonisrc.ts. Ace commands,
 * tests and the REPL boot the same application, and without that restriction
 * `node ace reminders:send` would start a scheduler of its own for as long as
 * the command ran, and the test suite would never exit.
 *
 * Started in `ready`, after the MongoDB and Redis providers have connected: the
 * first thing a job does is read the register.
 */
export default class SchedulerProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    const { default: scheduler } = await import('#services/scheduler')

    scheduler.start()
  }

  async shutdown() {
    const { default: scheduler } = await import('#services/scheduler')

    // Cancelled explicitly rather than left to the process ending. A pending
    // timer keeps the event loop alive, so without this a graceful shutdown
    // waits until the next 6am before the process actually exits.
    await scheduler.stop()
  }
}
