import { getAllUsers } from '../db/users.js'
import { getValidAccessToken, getValidAccessTokenById } from '../lib/token-refresh.js'
import { calculateWealth } from '../lib/wealth-calculator.js'
import { saveSnapshot } from '../db/snapshots.js'

export async function takeSnapshotForUser(userId: number, league: string): Promise<number> {
  const token = await getValidAccessTokenById(userId)
  const totalChaos = await calculateWealth(userId, token, league)
  if (totalChaos === -1) return -1 // already in progress
  saveSnapshot(userId, league, totalChaos)
  return totalChaos
}

// TODO: determine more efficient subset of users to snapshot based on last site access or something
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
      if (total === -1) {
        console.log(`[snapshot] ${user.ggg_account_name}: skipped (already in progress)`)
      } else {
        console.log(`[snapshot] ${user.ggg_account_name}: ${total.toFixed(1)}c`)
      }
    } catch (err) {
      console.error(`[snapshot] Failed for ${user.ggg_account_name}:`, err instanceof Error ? err.message : err)
    }
  }
}
