import { USER_AGENT } from './constants.js'

const DEFAULT_TOKEN_URL = 'https://www.pathofexile.com/oauth/token'

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
  // GGG includes these directly in the token response; other providers may not
  username?: string
  sub: string
}

async function postForm(body: Record<string, string>): Promise<TokenResponse> {
  const tokenUrl = process.env.OAUTH_TOKEN_URL ?? DEFAULT_TOKEN_URL
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams(body).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token request failed ${res.status}: ${text}`)
  }

  const data = await res.json() as TokenResponse
  if (!data.sub) throw new Error('Token response missing required sub field')
  return data
}

export function exchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  return postForm({
    client_id: process.env.OAUTH_CLIENT_ID!,
    client_secret: process.env.OAUTH_CLIENT_SECRET!,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return postForm({
    client_id: process.env.OAUTH_CLIENT_ID!,
    client_secret: process.env.OAUTH_CLIENT_SECRET!,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}
