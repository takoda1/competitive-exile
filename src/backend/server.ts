import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'

const REQUIRED_ENV = ['SESSION_SECRET', 'OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET'] as const
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

app.get('/', async () => {
  return { message: 'Hello Path Of Exile on Ngrok' }
})

try {
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
