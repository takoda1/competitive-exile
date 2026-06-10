import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import session from '@fastify/session'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { getUserById, type User } from '../db/users.js'
import { getValidAccessToken } from '../lib/token-refresh.js'

declare module '@fastify/session' {
  interface FastifySessionObject {
    oauthState?: string
    codeVerifier?: string
    userId?: number
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(async (app) => {
  await app.register(cookie)
  await app.register(session, {
    secret: process.env.SESSION_SECRET!,
    cookie: { secure: process.env.NODE_ENV !== 'development', httpOnly: true, sameSite: 'lax' },
  })

  app.decorateRequest('user', null)

  app.addHook('onRequest', async (req) => {
    const userId = req.session.userId
    if (userId != null) {
      req.user = getUserById(userId) ?? null
      if (req.user) {
        const expiry = new Date(req.user.token_expiry).getTime()
        if (Date.now() > expiry - 60 * 60 * 1000) {
          if (!req.user.refresh_token) {
            req.user = null
          } else {
            try {
              await getValidAccessToken(req.user)
              req.user = getUserById(userId) ?? null
            } catch (err) {
              req.log.warn({ err }, 'Token refresh failed; proceeding with existing token')
            }
          }
        }
      }
    }
  })

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user == null) {
      return reply.code(401).send({ error: 'Not authenticated' })
    }
  })
})
