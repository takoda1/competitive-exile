import { getAllUsers } from '../db/users.js'
import { getValidAccessToken } from '../lib/token-refresh.js'
import { calculateWealth } from '../lib/wealth-calculator.js'
import { saveSnapshot } from '../db/snapshots.js'

export async function takeSnapshotForUser(userId: number, league: string): Promise<number> {
  const token = await getValidAccessTokenById(userId)
  const totalChaos = await calculateWealth(userId, token, league)
  if (totalChaos === -1) return -1 // already in progress
  saveSnapshot(userId, league, totalChaos)
  return totalChaos
}

async function getValidAccessTokenById(userId: number): Promise<string> {
  const { getValidAccessTokenById: fn } = await import('../lib/token-refresh.js')
  return fn(userId)
}

export async function takeSnapshotsForAllUsers(): Promise<void> {
  const users = getAllUsers()
  const defaultLeague = process.env.DEFAULT_LEAGUE

  for (const user of users) {
    const league = user.selected_league ?? defaultLeague
    if (!league) {
      console.log(`[snapshot] Skipping user ${user.ggg_account_name} — no league set`)
      continue
    }
    console.log(`[snapshot] Taking snapshot for ${user.ggg_account_name} (${league})`)
    try {
      const total = await takeSnapshotForUser(user.id, league)
      console.log(`[snapshot] ${user.ggg_account_name}: ${total.toFixed(1)}c`)
    } catch (err) {
      console.error(`[snapshot] Failed for ${user.ggg_account_name}:`, err instanceof Error ? err.message : err)
    }
  }
}
