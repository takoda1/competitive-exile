import { refreshAccessToken } from './ggg-client.js'
import { getUserById, updateUserTokens, type User } from '../db/users.js'

const REFRESH_BUFFER_MS = 60 * 60 * 1000 // refresh when within 1 hour of expiry

export async function getValidAccessToken(user: User): Promise<string> {
  const expiry = new Date(user.token_expiry).getTime()
  if (Date.now() < expiry - REFRESH_BUFFER_MS) {
    return user.access_token
  }
  if (!user.refresh_token) {
    throw new Error('Token expired and no refresh token available')
  }
  const tokens = await refreshAccessToken(user.refresh_token)
  updateUserTokens(user.id, tokens.access_token, tokens.refresh_token ?? null, tokens.expires_in)
  return tokens.access_token
}

export async function getValidAccessTokenById(userId: number): Promise<string> {
  const user = getUserById(userId)
  if (!user) throw new Error(`User ${userId} not found`)
  return getValidAccessToken(user)
}
