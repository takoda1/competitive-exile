import type { FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../lib/pkce.js'
import { exchangeCode } from '../lib/ggg-client.js'
import { saveUser } from '../db/users.js'

const DEFAULT_AUTH_URL = 'https://www.pathofexile.com/oauth/authorize'
const DEFAULT_SCOPES = 'account:characters account:stashes account:leagues'

async function resolveUserInfo(
  accessToken: string,
  tokenSub: string,
  tokenUsername?: string,
): Promise<{ accountName: string; uuid: string }> {
  // GGG returns username + sub directly in the token response
  if (tokenUsername) return { accountName: tokenUsername, uuid: tokenSub }

  // Other providers: fetch from userinfo endpoint
  const userinfoUrl = process.env.OAUTH_USERINFO_URL
  if (!userinfoUrl) throw new Error('OAUTH_USERINFO_URL required for this provider')

  const res = await fetch(userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Userinfo request failed ${res.status}`)
  const info = await res.json() as { sub: string; name?: string; email?: string; preferred_username?: string }
  return {
    accountName: info.preferred_username ?? info.name ?? info.email ?? info.sub,
    uuid: info.sub,
  }
}

// Max OAuth-flow requests per minute per client (login + callback endpoints)
const OAUTH_RATE_LIMIT_MAX = 10
// Truncate OAuth error strings before including them in responses (prevents log injection)
const OAUTH_ERROR_PREVIEW_CHARS = 200

const oauthRateLimit = { config: { rateLimit: { max: OAUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } } } as const

export default async function authRoutes(app: FastifyInstance) {
  await app.register(rateLimit, { global: false })

  app.get('/login', oauthRateLimit, async (req, reply) => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    const state = generateState()

    req.session.codeVerifier = verifier
    req.session.oauthState = state

    const authUrl = process.env.OAUTH_AUTH_URL ?? DEFAULT_AUTH_URL
    const scopes = process.env.OAUTH_SCOPES ?? DEFAULT_SCOPES

    const params = new URLSearchParams({
      client_id: process.env.OAUTH_CLIENT_ID!,
      response_type: 'code',
      scope: scopes,
      state,
      redirect_uri: process.env.GGG_REDIRECT_URI!,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })

    return reply.redirect(`${authUrl}?${params.toString()}`)
  })

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/callback',
    oauthRateLimit,
    async (req, reply) => {
      const { code, state, error } = req.query

      if (error) {
        const safeError = String(error).slice(0, OAUTH_ERROR_PREVIEW_CHARS)
        return reply.code(400).send({ error: `OAuth error: ${safeError}` })
      }

      if (!code || !state) {
        return reply.code(400).send({ error: 'Missing code or state' })
      }

      if (state !== req.session.oauthState) {
        return reply.code(400).send({ error: 'State mismatch — possible CSRF' })
      }

      const codeVerifier = req.session.codeVerifier
      if (!codeVerifier) {
        return reply.code(400).send({ error: 'Invalid or expired session' })
      }

      req.session.oauthState = undefined
      req.session.codeVerifier = undefined

      try {
        const tokens = await exchangeCode(code, codeVerifier, process.env.GGG_REDIRECT_URI!)
        const { accountName, uuid } = await resolveUserInfo(
          tokens.access_token,
          tokens.sub,
          tokens.username,
        )

        const userId = saveUser(
          accountName,
          uuid,
          tokens.access_token,
          tokens.refresh_token ?? null,
          tokens.expires_in,
        )

        req.session.userId = userId
      } catch (err) {
        req.log.error(err, 'OAuth token exchange failed')
        return reply.code(400).send({ error: 'Authentication failed' })
      }

      return reply.redirect(process.env.FRONTEND_URL ?? '/')
    },
  )

  app.post('/logout', async (req, reply) => {
    await req.session.destroy()
    return reply.redirect('/')
  })

  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    return { accountName: req.user!.ggg_account_name, gggUuid: req.user!.ggg_uuid }
  })
}
