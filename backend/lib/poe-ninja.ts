import { upsertPriceCache } from '../db/price-cache.js'
import { USER_AGENT } from './constants.js'

const BASE = 'https://poe.ninja/poe1/api/economy/exchange/current/overview'
const UA = { 'User-Agent': USER_AGENT }

const CURRENCY_TYPES = ['Currency', 'Fragment']
const ITEM_TYPES = [
  'Oil', 'Incubator', 'Scarab', 'Fossil', 'Resonator', 'Essence',
  'DivinationCard', 'SkillGem', 'UniqueMap', 'Map', 'UniqueJewel',
  'UniqueFlask', 'UniqueWeapon', 'UniqueArmour', 'UniqueAccessory',
  'DeliriumOrb', 'Beast', 'Vial', 'Invitation', 'BlightedMap',
  'BaseType', 'ClusterJewel', 'UniqueRelic', 'Omen', 'Memory',
  'BlightedRavagedMap', 'AllflameEmber',
]

export const ALL_PRICE_CATEGORIES = [...CURRENCY_TYPES, ...ITEM_TYPES]

export interface PoeNinjaResponse {
  lines: Array<{ id: string; primaryValue: number }>
  core?: { items?: Array<{ id: string; name: string }> }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchCategory(league: string, type: string): Promise<void> {
  const url = `${BASE}?league=${encodeURIComponent(league)}&type=${encodeURIComponent(type)}`
  console.log(`[poe-ninja] GET ${url}`)
  const res = await fetch(url, { headers: UA })
  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)')
    throw new Error(`HTTP ${res.status} ${res.statusText} — URL: ${url} — body: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  upsertPriceCache(league, type, data)
  console.log(`[poe-ninja] OK ${type} (${league})`)
}

export async function refreshPrices(league: string): Promise<void> {
  const categories = [...CURRENCY_TYPES, ...ITEM_TYPES]

  let ok = 0
  let failed = 0
  for (const type of categories) {
    try {
      await fetchCategory(league, type)
      ok++
    } catch (err) {
      failed++
      console.error(`[poe-ninja] FAILED ${type} for ${league}:`, err instanceof Error ? err.message : err)
    }
    await sleep(100)
  }
  console.log(`[poe-ninja] ${league} complete — ${ok} ok, ${failed} failed`)
}
