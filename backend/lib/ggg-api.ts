import { USER_AGENT } from './constants.js'

const GGG_API = 'https://api.pathofexile.com'
const RATE_LIMIT_PREFIX = 'x-rate-limit-'
// Keep one request in reserve before treating the window as exhausted
const RATE_LIMIT_SAFETY_RESERVE = 1
// Fallback wait time when a 429 response omits the Retry-After header
const DEFAULT_RETRY_AFTER_SECONDS = 60
const UA = { 'User-Agent': USER_AGENT }

export interface StashTab {
  id: string
  name: string
  type: string
  index: number
  metadata?: { folder?: boolean; public?: boolean; colour?: string }
  children?: StashTab[]
}

export interface GGGItem {
  id: string
  typeLine: string
  name: string
  baseType?: string
  stackSize?: number
  maxStackSize?: number
}

function authHeaders(token: string) {
  return { ...UA, Authorization: `Bearer ${token}` }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Reads X-Rate-Limit-*-State headers and returns the minimum safe delay (ms)
// before the next request. GGG spreads N hits across a P-second window.
export function parseRateLimitDelay(headers: Headers): number {
  let minDelay = 0
  for (const [key, value] of headers.entries()) {
    const lk = key.toLowerCase()
    if (!lk.startsWith(RATE_LIMIT_PREFIX) || !lk.endsWith('-state')) continue
    const ruleName = lk.slice(RATE_LIMIT_PREFIX.length, -'-state'.length)
    const limitValue = headers.get(`${RATE_LIMIT_PREFIX}${ruleName}`)
    if (!limitValue) continue

    // Both formats: "hits:period:restriction"
    const [maxHits, period] = limitValue.split(':').map(Number)
    const [currentHits] = value.split(':').map(Number)
    if (!maxHits || !period) continue

    const remaining = maxHits - currentHits
    if (remaining <= RATE_LIMIT_SAFETY_RESERVE) {
      // Essentially at the limit — wait out the full window
      minDelay = Math.max(minDelay, period * 1000)
    } else {
      // Spread remaining budget evenly across the window
      minDelay = Math.max(minDelay, (period * 1000) / remaining)
    }
  }
  return minDelay
}

// Fetches with automatic retry on 429 using the Retry-After header.
// Returns the response and the suggested delay before the next GGG request.
async function gggFetch(url: string, headers: Record<string, string>): Promise<{ res: Response; nextDelay: number }> {
  let res = await fetch(url, { headers })

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get('Retry-After')
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : DEFAULT_RETRY_AFTER_SECONDS
    console.log(`[ggg-api] Rate limited — waiting ${retryAfter}s before retry`)
    await sleep(retryAfter * 1000)
    res = await fetch(url, { headers })
  }

  const nextDelay = parseRateLimitDelay(res.headers)
  return { res, nextDelay }
}

function stashBase(league: string, realm?: string): string {
  return realm
    ? `${GGG_API}/stash/${realm}/${encodeURIComponent(league)}`
    : `${GGG_API}/stash/${encodeURIComponent(league)}`
}

export async function listStashTabs(token: string, league: string, realm?: string): Promise<{ tabs: StashTab[]; nextDelay: number }> {
  const url = stashBase(league, realm)
  console.log(`[ggg-api] GET ${url}`)
  const { res, nextDelay } = await gggFetch(url, authHeaders(token))
  if (!res.ok) throw new Error(`GGG stash list ${res.status}: ${await res.text().catch(() => '')}`)
  const data = await res.json() as { stashes: StashTab[] }
  const stashes = data.stashes ?? []

  // Flatten: folders don't contain items — their children do
  const flat: StashTab[] = []
  for (const tab of stashes) {
    if (tab.children && tab.children.length > 0) {
      flat.push(...tab.children)
    } else if (!tab.metadata?.folder) {
      flat.push(tab)
    }
  }
  console.log(`[ggg-api] ${flat.length} fetchable tabs (${stashes.length} top-level)`)
  return { tabs: flat, nextDelay }
}

export async function getStashTab(token: string, league: string, stashId: string, realm?: string): Promise<{ items: GGGItem[]; nextDelay: number }> {
  const url = `${stashBase(league, realm)}/${stashId}`
  const { res, nextDelay } = await gggFetch(url, authHeaders(token))
  if (!res.ok) throw new Error(`GGG stash tab ${res.status}: ${await res.text().catch(() => '')}`)
  const data = await res.json() as { stash: { items?: GGGItem[] } }
  return { items: data.stash.items ?? [], nextDelay }
}

export interface GGGLeague {
  id: string
  name: string
  realm?: string
  category?: { id: string; current?: boolean }
}

export async function getAccountLeagues(token: string): Promise<GGGLeague[]> {
  const url = `${GGG_API}/account/leagues`
  console.log(`[ggg-api] GET ${url}`)
  const { res } = await gggFetch(url, authHeaders(token))
  if (!res.ok) throw new Error(`GGG account leagues ${res.status}: ${await res.text().catch(() => '')}`)
  const data = await res.json() as { leagues?: GGGLeague[] } | GGGLeague[]
  const all = Array.isArray(data) ? data : (data.leagues ?? [])
  return all.filter(l => l.category?.current === true)
}
