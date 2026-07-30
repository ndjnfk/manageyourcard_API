import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Creates an administrator of the panel.
 *
 *   node ace admin:create
 *   node ace admin:create --email=me@shop.com --name="Vaibhav" --password=secret123
 *
 * There is no admin sign-up page and there never should be — an installation
 * where anyone can make themselves an admin is not an admin panel. The command
 * line is the only way in, which means it takes access to the server.
 *
 * Running it against an email that already exists resets that admin's
 * password. That is deliberate: it is also the way back in from a forgotten
 * one, and failing on a duplicate would leave no route short of editing the
 * database by hand.
 */
export default class CreateAdmin extends BaseCommand {
  static commandName = 'admin:create'
  static description = 'Create an admin, or reset an existing admin’s password'

  /**
   * The app has to boot: the admins live in MongoDB, and the connection is
   * opened by a provider rather than on first use.
   */
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Email address to sign in with' })
  declare email: string

  @flags.string({ description: 'Name shown in the panel' })
  declare name: string

  @flags.string({ description: 'Password. Omit to be prompted without it being echoed' })
  declare password: string

  async run() {
    const { default: admins } = await import('#services/admin/admins')

    const email = this.email ?? (await this.prompt.ask('Email address', { validate: isEmail }))
    const name = this.name ?? (await this.prompt.ask('Name', { validate: isNotEmpty }))

    // secure() rather than ask(): a password typed in front of anyone, and
    // left in the shell history by --password, is a password worth changing.
    const password =
      this.password ?? (await this.prompt.secure('Password', { validate: isStrongEnough }))

    const existing = await admins.findByEmail(email)

    const admin = await admins.create({ name, email, password })

    this.logger.success(
      existing
        ? `Reset the password for ${admin.email}`
        : `Created admin ${admin.email} (${admin.name})`
    )
    this.logger.info('Sign in at /admin/login')
  }
}

function isNotEmpty(value?: string): true | string {
  return value?.trim() ? true : 'This cannot be empty'
}

function isEmail(value?: string): true | string {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value?.trim() ?? '')
    ? true
    : 'Enter a complete email address'
}

/**
 * The same rule the shopkeepers get. An admin password guarding every shop's
 * data has no business being weaker than the one guarding a single shop.
 */
function isStrongEnough(value?: string): true | string {
  const password = value ?? ''

  if (password.length < 8) return 'Use at least 8 characters'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Include at least one letter and one number'
  }
  return true
}
