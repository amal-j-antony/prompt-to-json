import { createApp } from './app'
import { config } from './config'
import { Database } from './db'

const database = new Database({ uri: config.mongoUri, dbName: config.mongoDbName })
const app = createApp({ config, db: database })

if (!config.mongoUri) {
  console.warn('MONGODB_URI is not set. Database routes will return 503.')
}

database.start()

const server = app.listen(config.port, () => {
  console.log(`server listening on port ${config.port}`)
})

let shuttingDown = false

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`received ${signal}, shutting down`)

  const forceExit = setTimeout(() => process.exit(1), 10_000)
  forceExit.unref()

  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
  await database.close().catch(() => undefined)
  process.exit(0)
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})
