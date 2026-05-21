import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import session from '@fastify/session'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { getUserById, type User } from '../db/users.js'

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
    cookie: { secure: process.env.NODE_ENV !== 'development', httpOnly: true, sameSite: 'strict' },
  })

  app.decorateRequest('user', null)

  app.addHook('onRequest', async (req) => {
    const userId = req.session.userId
    if (userId != null) {
      req.user = getUserById(userId) ?? null
    }
  })

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user == null) {
      reply.code(401).send({ error: 'Not authenticated' })
    }
  })
})
