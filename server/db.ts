import { MongoClient, type Db, type Collection } from 'mongodb'
import type { ObjectId } from 'mongodb'
import type { FieldDocs } from '../shared/brief-docs'

export type UserDoc = {
  _id: ObjectId
  email: string
  passwordHash: string
  createdAt: Date
}

export type SessionDoc = {
  _id: string
  userId: ObjectId
  createdAt: Date
  expiresAt: Date
}

export type BriefDoc = {
  _id: ObjectId
  userId: ObjectId
  title: string
  savedAt: number
  docs: FieldDocs
  createdAt: Date
}

export interface Collections {
  users: Collection<UserDoc>
  sessions: Collection<SessionDoc>
  briefs: Collection<BriefDoc>
}

export type DbStatus = 'connected' | 'connecting' | 'error'

export interface DatabaseOptions {
  uri: string
  dbName: string
  retryMs?: number
  selectionTimeoutMs?: number
}

async function ensureIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection<UserDoc>('users').createIndex({ email: 1 }, { unique: true }),
    database.collection<SessionDoc>('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection<BriefDoc>('briefs').createIndex({ userId: 1, savedAt: -1 }),
  ])
}

export function isMongoUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.name === 'MongoNetworkError' ||
    error.name === 'MongoNetworkTimeoutError' ||
    error.name === 'MongoServerSelectionError' ||
    error.name === 'MongoTopologyClosedError'
  )
}

export class Database {
  private readonly uri: string
  private readonly dbName: string
  private readonly retryMs: number
  private readonly selectionTimeoutMs: number
  private client: MongoClient | null = null
  private database: Db | null = null
  private timer: NodeJS.Timeout | null = null
  private stopped = false
  private currentStatus: DbStatus = 'connecting'

  constructor(options: DatabaseOptions) {
    this.uri = options.uri
    this.dbName = options.dbName
    this.retryMs = options.retryMs ?? 5000
    this.selectionTimeoutMs = options.selectionTimeoutMs ?? 8000
  }

  get status(): DbStatus {
    return this.currentStatus
  }

  collections(): Collections | null {
    if (this.currentStatus !== 'connected' || !this.database) return null
    return {
      users: this.database.collection<UserDoc>('users'),
      sessions: this.database.collection<SessionDoc>('sessions'),
      briefs: this.database.collection<BriefDoc>('briefs'),
    }
  }

  start(): void {
    this.stopped = false
    void this.attempt()
  }

  markUnavailable(): void {
    this.currentStatus = 'error'
    const client = this.client
    this.client = null
    this.database = null
    if (client) void client.close().catch(() => undefined)
    if (!this.stopped && !this.timer) this.schedule()
  }

  async close(): Promise<void> {
    this.stopped = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const client = this.client
    this.client = null
    this.database = null
    this.currentStatus = 'error'
    if (client) await client.close()
  }

  private async attempt(): Promise<void> {
    if (this.stopped) return
    this.currentStatus = 'connecting'
    let client: MongoClient | null = null
    try {
      client = new MongoClient(this.uri, { serverSelectionTimeoutMS: this.selectionTimeoutMs })
      await client.connect()
      if (this.stopped) {
        await client.close()
        return
      }
      const database = client.db(this.dbName)
      await ensureIndexes(database)
      if (this.stopped) {
        await client.close()
        return
      }
      this.client = client
      this.database = database
      this.currentStatus = 'connected'
      console.log('mongo connected')
    } catch (error) {
      if (client) await client.close().catch(() => undefined)
      this.currentStatus = 'error'
      console.error('mongo connection failed', error instanceof Error ? error.name : 'unknown error')
      this.schedule()
    }
  }

  private schedule(): void {
    if (this.stopped) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.attempt()
    }, this.retryMs)
  }
}
