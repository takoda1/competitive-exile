import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exchangeCode, refreshAccessToken } from '../lib/ggg-client.js'

const GGG_TOKEN_URL = 'https://www.pathofexile.com/oauth/token'

const mockTokenResponse = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 2592000,
  token_type: 'bearer',
  scope: 'account:profile',
  username: 'TestUser',
  sub: 'test-uuid',
}

function makeMockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

beforeEach(() => {
  process.env.OAUTH_CLIENT_ID = 'test-client-id'
  process.env.OAUTH_CLIENT_SECRET = 'test-client-secret'
  delete process.env.OAUTH_TOKEN_URL
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exchangeCode', () => {
  it('POSTs to the GGG token URL by default', async () => {
    const mockFetch = makeMockFetch(200, mockTokenResponse)
    vi.stubGlobal('fetch', mockFetch)

    await exchangeCode('auth-code', 'verifier', 'https://example.com/callback')

    expect(mockFetch).toHaveBeenCalledWith(GGG_TOKEN_URL, expect.objectContaining({ method: 'POST' }))
  })

  it('uses OAUTH_TOKEN_URL env var when set', async () => {
    process.env.OAUTH_TOKEN_URL = 'https://custom-provider.com/token'
    const mockFetch = makeMockFetch(200, mockTokenResponse)
    vi.stubGlobal('fetch', mockFetch)

    await exchangeCode('auth-code', 'verifier', 'https://example.com/callback')

    expect(mockFetch).toHaveBeenCalledWith('https://custom-provider.com/token', expect.anything())
  })

  it('sends required body params', async () => {
    const mockFetch = makeMockFetch(200, mockTokenResponse)
    vi.stubGlobal('fetch', mockFetch)

    await exchangeCode('my-code', 'my-verifier', 'https://example.com/callback')

    const body = new URLSearchParams((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('my-code')
    expect(body.get('code_verifier')).toBe('my-verifier')
    expect(body.get('redirect_uri')).toBe('https://example.com/callback')
    expect(body.get('client_id')).toBe('test-client-id')
    expect(body.get('client_secret')).toBe('test-client-secret')
  })

  it('throws with status code on non-200 response', async () => {
    vi.stubGlobal('fetch', makeMockFetch(400, { error: 'invalid_grant' }))

    await expect(
      exchangeCode('bad-code', 'verifier', 'https://example.com/callback'),
    ).rejects.toThrow('400')
  })
})

describe('refreshAccessToken', () => {
  it('sends refresh_token grant type with the provided token', async () => {
    const mockFetch = makeMockFetch(200, mockTokenResponse)
    vi.stubGlobal('fetch', mockFetch)

    await refreshAccessToken('my-refresh-token')

    const body = new URLSearchParams((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('my-refresh-token')
    expect(body.get('client_id')).toBe('test-client-id')
    expect(body.get('client_secret')).toBe('test-client-secret')
  })
})
