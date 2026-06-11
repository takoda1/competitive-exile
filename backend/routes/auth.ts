import type { FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../lib/pkce.js'
import { exchangeCode } from '../lib/ggg-client.js'
import { saveUser, getUserById, updateSelectedLeague } from '../db/users.js'
import { getAccountLeagues } from '../lib/ggg-api.js'

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

  app.get<{ Querystring: { redirect?: string } }>('/login', oauthRateLimit, async (req, reply) => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    const state = generateState()

    req.session.codeVerifier = verifier
    req.session.oauthState = state

    // Only allow relative paths to prevent open redirect
    const redirectPath = req.query.redirect
    if (redirectPath && /^\/[^/]/.test(redirectPath)) {
      req.session.postLoginRedirect = redirectPath
    }

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
      const postLoginRedirect = req.session.postLoginRedirect
      req.session.postLoginRedirect = undefined

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

        // Auto-select first league if the user has none set
        const user = getUserById(userId)
        if (user && !user.selected_league) {
          try {
            const leagues = await getAccountLeagues(tokens.access_token)
            if (leagues.length > 0) updateSelectedLeague(userId, leagues[0].id)
          } catch (err) {
            req.log.warn(err, 'Could not auto-select league on first login')
          }
        }
      } catch (err) {
        req.log.error(err, 'OAuth token exchange failed')
        return reply.code(400).send({ error: 'Authentication failed' })
      }

      const base = process.env.FRONTEND_URL ?? ''
      return reply.redirect(postLoginRedirect ? `${base}${postLoginRedirect}` : `${base}/`)
    },
  )

  app.post('/logout', async (req, reply) => {
    await req.session.destroy()
    return reply.redirect('/')
  })

  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    return {
      accountName: req.user!.ggg_account_name,
      gggUuid: req.user!.ggg_uuid,
      selectedLeague: req.user!.selected_league,
    }
  })
}
