import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import apiRoutes from './routes/api.js'
import { pruneSnapshots } from './db/snapshots.js'
import { refreshPricesForActiveLeagues } from './jobs/price-refresh.js'
import { takeSnapshotsForAllUsers } from './jobs/snapshot.js'

const REQUIRED_ENV = ['SESSION_SECRET', 'OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'GGG_REDIRECT_URI'] as const

const DEFAULT_PORT = 3000
// Run snapshot pruning once per day (keeps the DB from growing unboundedly)
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000
// Refresh poe.ninja prices and take wealth snapshots once per hour
const HOURLY_INTERVAL_MS = 60 * 60 * 1000
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`)
    process.exit(1)
  }
}

const app = Fastify({ logger: true })

await app.register(helmet)

await app.register(authPlugin)
await app.register(authRoutes, { prefix: '/auth' })
await app.register(apiRoutes, { prefix: '/api' })

app.get('/', async () => {
  return { message: 'Hello Path Of Exile on Ngrok' }
})

pruneSnapshots()
setInterval(pruneSnapshots, PRUNE_INTERVAL_MS)

refreshPricesForActiveLeagues()
setInterval(refreshPricesForActiveLeagues, HOURLY_INTERVAL_MS)

takeSnapshotsForAllUsers()
setInterval(takeSnapshotsForAllUsers, HOURLY_INTERVAL_MS)

try {
  await app.listen({ port: Number(process.env.PORT ?? DEFAULT_PORT), host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
