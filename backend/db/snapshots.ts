import db from './connection.js'

export interface Snapshot {
  id: number
  user_id: number
  league: string
  total_chaos: number
  taken_at: string
}

const SNAPSHOT_TTL_DAYS = 30 // A majority of players are not playing past 30 days

const insertSnapshot = db.prepare<[number, string, number]>(
  'INSERT INTO snapshots (user_id, league, total_chaos) VALUES (?, ?, ?)',
)

const getByUserLeague = db.prepare<[number, string, number]>(
  'SELECT * FROM snapshots WHERE user_id = ? AND league = ? ORDER BY taken_at DESC LIMIT ?',
)

const deleteOld = db.prepare(
  "DELETE FROM snapshots WHERE taken_at < datetime('now', ?)",
)

export function saveSnapshot(userId: number, league: string, totalChaos: number): void {
  insertSnapshot.run(userId, league, totalChaos)
}

export function getSnapshots(userId: number, league: string, limit = 168): Snapshot[] {
  return getByUserLeague.all(userId, league, limit) as Snapshot[]
}

const latestPerUser = db.prepare(`
  SELECT u.ggg_account_name, s.total_chaos, s.taken_at, s.league
  FROM users u
  JOIN snapshots s ON s.user_id = u.id
  WHERE s.id = (
    SELECT id FROM snapshots s2
    WHERE s2.user_id = u.id AND s2.league = ?
    ORDER BY s2.taken_at DESC LIMIT 1
  )
  ORDER BY s.total_chaos DESC
`)

export interface LeaderboardEntry {
  ggg_account_name: string
  total_chaos: number
  taken_at: string
  league: string
}

export function getLeaderboard(league: string): LeaderboardEntry[] {
  return latestPerUser.all(league) as LeaderboardEntry[]
}

export function pruneSnapshots(maxAgeDays = SNAPSHOT_TTL_DAYS): number {
  const result = deleteOld.run(`-${maxAgeDays} days`)
  return result.changes
}
