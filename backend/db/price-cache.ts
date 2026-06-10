import db from './connection.js'

export interface PriceCacheEntry {
  league: string
  category: string
  data_json: string
  fetched_at: string
}

const upsert = db.prepare(`
  INSERT INTO price_cache (league, category, data_json, fetched_at)
  VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT(league, category) DO UPDATE SET
    data_json  = excluded.data_json,
    fetched_at = excluded.fetched_at
`)

const getEntry = db.prepare<[string, string]>(
  'SELECT * FROM price_cache WHERE league = ? AND category = ?',
)

export function upsertPriceCache(league: string, category: string, data: unknown): void {
  upsert.run(league, category, JSON.stringify(data))
}

export function getPriceCache(league: string, category: string): PriceCacheEntry | undefined {
  return getEntry.get(league, category) as PriceCacheEntry | undefined
}

// Matches the hourly price-refresh job interval — stale after one missed refresh cycle
const DEFAULT_CACHE_MAX_AGE_MS = 60 * 60 * 1000

export function isCacheStale(fetchedAt: string, maxAgeMs = DEFAULT_CACHE_MAX_AGE_MS): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs
}
