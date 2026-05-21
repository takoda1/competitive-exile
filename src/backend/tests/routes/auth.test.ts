import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import authPlugin from '../../plugins/auth.js'
import authRoutes from '../../routes/auth.js'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify()
  await app.register(authPlugin)
  await app.register(authRoutes, { prefix: '/auth' })
  await app.ready()
  return app
}

beforeAll(() => {
  process.env.SESSION_SECRET = 'a'.repeat(32)
  process.env.OAUTH_CLIENT_ID = 'test-client'
  process.env.GGG_REDIRECT_URI = 'https://example.com/auth/callback'
})

describe('GET /auth/login', () => {
  it('redirects with 302', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/login' })
    expect(res.statusCode).toBe(302)
  })

  it('redirects to the GGG authorize URL by default', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/login' })
    expect(res.headers.location).toMatch(/^https:\/\/www\.pathofexile\.com\/oauth\/authorize/)
  })

  it('redirect includes required OAuth params', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/login' })
    const url = new URL(res.headers.location as string)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('client_id')).toBe('test-client')
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/auth/callback')
    expect(url.searchParams.get('scope')).toBeTruthy()
  })
})

describe('GET /auth/callback', () => {
  it('returns 400 when OAuth provider returns an error', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/auth/callback?error=access_denied',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('access_denied')
  })

  it('returns 400 when code or state is missing', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/callback' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('Missing code or state')
  })

  it('returns 400 on state mismatch (CSRF protection)', async () => {
    const app = await buildApp()
    // No prior /auth/login call means session has no oauthState — any state value will mismatch
    const res = await app.inject({
      method: 'GET',
      url: '/auth/callback?code=somecode&state=tampered-state',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('State mismatch')
  })
})

describe('GET /auth/me', () => {
  it('returns 401 when not authenticated', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
  })
})
