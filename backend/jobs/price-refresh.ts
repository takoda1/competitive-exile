import { getActiveLeagues } from '../db/users.js'
import { refreshPrices } from '../lib/poe-ninja.js'

export async function refreshPricesForActiveLeagues(): Promise<void> {
  const leagues = new Set(getActiveLeagues())
  if (process.env.DEFAULT_LEAGUE) leagues.add(process.env.DEFAULT_LEAGUE)

  if (leagues.size === 0) {
    console.log('[price-refresh] No active leagues, skipping')
    return
  }

  for (const league of leagues) {
    console.log(`[price-refresh] Refreshing poe.ninja prices for ${league}`)
    await refreshPrices(league)
    console.log(`[price-refresh] Done: ${league}`)
  }
}
