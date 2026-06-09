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

// Column migrations — ALTER TABLE can't use IF NOT EXISTS, so we check via PRAGMA
const userColumns = new Set(
  (db.pragma('table_info(users)') as Array<{ name: string }>).map(c => c.name)
)
if (!userColumns.has('selected_league')) {
  db.exec('ALTER TABLE users ADD COLUMN selected_league TEXT')
}

export default db
