import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const dbFile = process.env.DB_FILE ?? './competitive_exile.db'
const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', dbFile)

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql')
db.exec(fs.readFileSync(schemaPath, 'utf8'))

export interface User {
  id: number
  ggg_account_name: string
  ggg_uuid: string
  access_token: string
  refresh_token: string | null
  token_expiry: string
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
