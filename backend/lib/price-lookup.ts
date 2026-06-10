import { getPriceCache } from '../db/price-cache.js'
import { ALL_PRICE_CATEGORIES, type PoeNinjaResponse } from './poe-ninja.js'
import type { GGGItem } from './ggg-api.js'

// "Chaos Orb" → "chaos-orb", "Rogue's Marker" → "rogues-marker"
function toSlug(name: string): string {
  return name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-')
}

// Strip GGG display markup: <<set:MS>><<set:M>><<set:S>>Shavronne's Wrappings → Shavronne's Wrappings
function cleanName(name: string): string {
  return name.replace(/<<[^>]+>>/g, '').trim()
}

export interface PriceMap {
  bySlug: Map<string, number>
  byName: Map<string, number>
}

export function buildPriceMap(league: string): PriceMap {
  // slug → chaos value (e.g. "ambush-scarab" → 27.8)
  const bySlug = new Map<string, number>()
  // display name → chaos value (e.g. "Chaos Orb" → 1, "Divine Orb" → 603.8)
  const byName = new Map<string, number>()

  for (const category of ALL_PRICE_CATEGORIES) {
    const cached = getPriceCache(league, category)
    if (!cached) continue

    let data: PoeNinjaResponse
    try {
      data = JSON.parse(cached.data_json)
    } catch {
      continue
    }

    const lines = data.lines ?? []

    // Build slug → value from lines
    for (const line of lines) {
      if (line.id && line.primaryValue != null) {
        bySlug.set(line.id, line.primaryValue)
      }
    }

    // Build name → value from core.items (for items that have explicit display names, e.g. Chaos Orb, Divine Orb)
    const coreItems = data.core?.items ?? []
    for (const item of coreItems) {
      const line = lines.find(l => l.id === item.id)
      if (line && item.name) {
        byName.set(item.name, line.primaryValue)
      }
    }
  }

  return { bySlug, byName }
}

export function getItemChaosValue(item: GGGItem, priceMap: PriceMap): number {
  const { bySlug, byName } = priceMap
  const stack = item.stackSize ?? 1

  const uniqueName = cleanName(item.name)
  const typeLine = cleanName(item.typeLine)

  // Try exact display name match (handles Chaos Orb, Divine Orb)
  const byNameMatch = byName.get(typeLine) ?? byName.get(uniqueName)
  if (byNameMatch != null) return byNameMatch * stack

  // Try slug conversion of typeLine (handles Ambush Scarab → ambush-scarab)
  const typeSlug = toSlug(typeLine)
  const byTypeSlug = bySlug.get(typeSlug)
  if (byTypeSlug != null) return byTypeSlug * stack

  // Try slug conversion of unique name (handles unique item names)
  if (uniqueName) {
    const nameSlug = toSlug(uniqueName)
    const byNameSlug = bySlug.get(nameSlug)
    if (byNameSlug != null) return byNameSlug * stack
  }

  return 0
}
