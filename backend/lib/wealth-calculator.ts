import { listStashTabs, getStashTab } from './ggg-api.js'
import { buildPriceMap, getItemChaosValue } from './price-lookup.js'

// Minimum delay between stash tab fetches regardless of rate limit headers
const MIN_TAB_DELAY_MS = 1500

// Prevents two concurrent wealth calculations for the same user
const inProgress = new Set<number>()

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function calculateWealth(userId: number, accessToken: string, league: string): Promise<number> {
  if (inProgress.has(userId)) {
    console.log(`[wealth] Skipping user ${userId} — calculation already in progress`)
    return -1
  }
  inProgress.add(userId)

  try {
    const priceMap = buildPriceMap(league)
    const { tabs, nextDelay: afterList } = await listStashTabs(accessToken, league)
    console.log(`[wealth] Fetching ${tabs.length} stash tabs for league ${league}`)

    let totalChaos = 0
    let pricedItems = 0
    let unpricedItems = 0
    let delay = Math.max(MIN_TAB_DELAY_MS, afterList)

    for (const tab of tabs) {
      await sleep(delay)
      try {
        const { items, nextDelay } = await getStashTab(accessToken, league, tab.id)
        delay = Math.max(MIN_TAB_DELAY_MS, nextDelay)
        for (const item of items) {
          const value = getItemChaosValue(item, priceMap)
          if (value > 0) pricedItems++
          else unpricedItems++
          totalChaos += value
        }
      } catch (err) {
        console.error(`[wealth] Failed to fetch tab "${tab.name}" (${tab.id}):`, err instanceof Error ? err.message : err)
        delay = MIN_TAB_DELAY_MS
      }
    }

    console.log(`[wealth] Total: ${totalChaos.toFixed(1)}c — priced: ${pricedItems}, unpriced: ${unpricedItems}`)
    return totalChaos
  } finally {
    inProgress.delete(userId)
  }
}
