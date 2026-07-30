import env from '#start/env'
import { Collection, Db, Document, MongoClient } from 'mongodb'

/**
 * The application's MongoDB connection.
 *
 * One MongoClient for the whole process: the driver pools connections
 * internally, so opening a client per request would throw away the pool and
 * pay a fresh handshake every time. `#providers/mongodb_provider` owns its
 * lifecycle — it connects when the app boots and disconnects on shutdown.
 */
class Mongodb {
  #client: MongoClient | null = null

  /**
   * Opens the connection. Called once on boot rather than lazily on the first
   * query, so that a wrong URI or an unreachable server fails loudly at
   * startup instead of as a 500 on somebody's registration.
   */
  async connect(): Promise<void> {
    if (this.#client) return

    const client = new MongoClient(env.get('MONGO_URI'), {
      // Fail fast while starting up. The driver's default is 30s, which turns
      // "mongod isn't running" into a very long, silent wait.
      serverSelectionTimeoutMS: 5_000,
    })

    await client.connect()
    this.#client = client
  }

  async close(): Promise<void> {
    if (!this.#client) return

    await this.#client.close()
    this.#client = null
  }

  get db(): Db {
    if (!this.#client) {
      throw new Error('MongoDB is not connected. Was the MongoDB provider registered?')
    }

    return this.#client.db(env.get('MONGO_DB_NAME'))
  }

  collection<T extends Document>(name: string): Collection<T> {
    return this.db.collection<T>(name)
  }
}

export default new Mongodb()
