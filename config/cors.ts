import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/cors'

/**
 * Origins allowed to call this API from a browser, read from CORS_ORIGIN as a
 * comma-separated list. The Angular dev server runs on a different port to the
 * API, so without at least one entry here every request from it is a
 * cross-origin request the browser refuses to hand back.
 */
const allowedOrigins = (env.get('CORS_ORIGIN') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  /**
   * Enable or disable CORS handling globally.
   */
  enabled: true,

  /**
   * An explicit CORS_ORIGIN allowlist always wins. With none set, development
   * allows every origin to simplify local front/backend setup, and production
   * allows none — so no cross-origin browser access until it is configured.
   */
  origin: allowedOrigins.length > 0 ? allowedOrigins : app.inDev ? true : [],

  /**
   * HTTP methods accepted for cross-origin requests.
   */
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Reflect request headers by default. Use a string array to restrict
   * allowed headers.
   */
  headers: true,

  /**
   * Response headers exposed to the browser.
   */
  exposeHeaders: [],

  /**
   * Allow cookies/authorization headers on cross-origin requests.
   */
  credentials: true,

  /**
   * Cache CORS preflight response for N seconds.
   */
  maxAge: 90,
})

export default corsConfig
