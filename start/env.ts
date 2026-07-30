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
})
