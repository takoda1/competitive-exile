import db from './connection.js'

export interface User {
  id: number
  ggg_account_name: string
  ggg_uuid: string
  access_token: string
  refresh_token: string | null
  token_expiry: string
  selected_league: string | null
}

const upsertUser = db.prepare<[string, string, string, string | null, string]>(`
  INSERT INTO users (ggg_account_name, ggg_uuid, access_token, refresh_token, token_expiry)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(ggg_uuid) DO UPDATE SET
    ggg_account_name = excluded.ggg_account_name,
    access_token     = excluded.access_token,
    refresh_token    = excluded.refresh_token,
    token_expiry     = excluded.token_expiry
  RETURNING id
`)

export function saveUser(
  accountName: string,
  uuid: string,
  accessToken: string,
  refreshToken: string | null,
  expiresInSeconds: number,
): number {
  const expiry = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
  const row = upsertUser.get(accountName, uuid, accessToken, refreshToken, expiry) as { id: number }
  return row.id
}

const getById = db.prepare<[number]>('SELECT * FROM users WHERE id = ?')

export function getUserById(id: number): User | undefined {
  return getById.get(id) as User | undefined
}

const allUsers = db.prepare('SELECT * FROM users')

export function getAllUsers(): User[] {
  return allUsers.all() as User[]
}

const activeLeagues = db.prepare(
  'SELECT DISTINCT selected_league FROM users WHERE selected_league IS NOT NULL',
)

export function getActiveLeagues(): string[] {
  return (activeLeagues.all() as { selected_league: string }[]).map(r => r.selected_league)
}

const setLeague = db.prepare<[string, number]>('UPDATE users SET selected_league = ? WHERE id = ?')

export function updateSelectedLeague(id: number, league: string): void {
  setLeague.run(league, id)
}

const updateTokens = db.prepare<[string, string | null, string, number]>(`
  UPDATE users SET access_token = ?, refresh_token = ?, token_expiry = ? WHERE id = ?
`)

export function updateUserTokens(
  id: number,
  accessToken: string,
  refreshToken: string | null,
  expiresInSeconds: number,
): void {
  const expiry = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
  updateTokens.run(accessToken, refreshToken, expiry, id)
}
