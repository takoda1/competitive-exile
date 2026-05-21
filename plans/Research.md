# competitive-exile Research

## Human written notes

- 
- There are strict trade api limits imposed by GGG. Cache unique item prices in local storage, refresh rate can be relatively slow as item prices don't usually change instantly (every 30 mins - 60 minutes)
- Also cache stackable/currency prices aggressively also with a ~30-60 minute refresh rate. If players want realtime currency rates for trading they can use the in-game systems for that.
- MVP for wealth tracker is only stackable items at first.
- Then move on to uniques in stash, then uniques + searchable items the user's characters have
- Utilize poe.ninja api for uniques and currency items and refresh every hour

## AI research

## Path of Exile Trade API

### Overview

The official PoE trade site exposes two endpoints used for price checking items. The hostname varies by region:

| Region | Host |
|--------|------|
| English (default) | `www.pathofexile.com` |
| Russian | `ru.pathofexile.com` |
| Taiwan | `pathofexile.tw` |
| Korean | `poe.game.daum.net` |

---

### 1. Trade Search (Regular Items)

Used for weapons, armour, flasks, gems, maps, unique items, etc.

#### Step 1 — Submit Search

**POST** `https://www.pathofexile.com/api/trade/search/{leagueId}`

Headers:
```
Accept: application/json
Content-Type: application/json
```

Request body:
```json
{
  "query": {
    "status": { "option": "online" },
    "name": "Shavronne's Wrappings",
    "type": "Occultist's Vestment",
    "stats": [
      {
        "type": "and",
        "filters": [
          {
            "id": "stat_id_here",
            "value": { "min": 30, "max": 50 },
            "disabled": false
          }
        ],
        "disabled": false
      }
    ],
    "filters": {
      "type_filters": {
        "filters": {
          "rarity": { "option": "unique" },
          "category": { "option": "armour.chest" }
        }
      },
      "socket_filters": {
        "filters": {
          "links": { "min": 6 },
          "sockets": { "min": 6 }
        }
      },
      "misc_filters": {
        "filters": {
          "ilvl": { "min": 80 },
          "quality": { "min": 20 },
          "gem_level": { "min": 20 },
          "corrupted": { "option": "false" }
        }
      },
      "armour_filters": {
        "filters": {
          "ar": { "min": 100 },
          "es": { "min": 100 },
          "ev": { "min": 100 }
        }
      },
      "weapon_filters": {
        "filters": {
          "dps": { "min": 300 },
          "pdps": { "min": 200 }
        }
      },
      "map_filters": {
        "filters": {
          "map_tier": { "min": 14 }
        }
      },
      "trade_filters": {
        "filters": {
          "collapse": { "option": "true" },
          "indexed": { "option": "1week" },
          "price": { "min": 1, "option": "chaos" }
        }
      }
    }
  },
  "sort": { "price": "asc" }
}
```

Response:
```json
{
  "id": "QUERY_ID",
  "result": ["ITEM_ID_1", "ITEM_ID_2", "..."],
  "total": 1234,
  "inexact": false
}
```

- `id` — query ID used in the fetch step
- `result` — up to 50,000 item listing IDs
- `total` — total number of matching listings
- `inexact` — whether results may not be an exact match

---

#### Step 2 — Fetch Listings

**GET** `https://www.pathofexile.com/api/trade/fetch/{ids}?query={queryId}`

- `{ids}` — comma-separated list of item IDs from the search response (fetch in batches, typically 10 at a time)
- `{queryId}` — the `id` from the search response

Response:
```json
{
  "result": [
    {
      "id": "LISTING_ID",
      "item": {
        "ilvl": 86,
        "stackSize": 1,
        "corrupted": false,
        "properties": [
          { "name": "Quality", "values": [["+20%", 1]], "displayMode": 0 }
        ],
        "note": "~price 5 chaos"
      },
      "listing": {
        "indexed": "2024-01-01T00:00:00Z",
        "price": {
          "amount": 5,
          "currency": "chaos",
          "type": "~price"
        },
        "fee": 0,
        "account": {
          "name": "AccountName",
          "lastCharacterName": "CharacterName",
          "online": { "status": "afk" }
        }
      }
    }
  ]
}
```

---

### 2. Bulk / Exchange (Currency & Bulk Items)

Used for currency, fragments, scarabs, oils, and other stackable items.

**POST** `https://www.pathofexile.com/api/trade/exchange/{leagueId}`

Headers:
```
Accept: application/json
Content-Type: application/json
```

Request body:
```json
{
  "engine": "new",
  "query": {
    "status": { "option": "online" },
    "want": ["chaos"],
    "have": ["divine"],
    "minimum": 1,
    "fulfillable": null
  },
  "sort": { "have": "asc" }
}
```

- `want` — array of currency tags the buyer wants to receive
- `have` — array of currency tags the buyer is offering
- `status.option` — `"online"`, `"onlineleague"`, or `"any"`

Response (results are inline, no second fetch needed):
```json
{
  "id": "QUERY_ID",
  "result": {
    "LISTING_ID_1": {
      "listing": {
        "indexed": "2024-01-01T00:00:00Z",
        "account": {
          "name": "AccountName",
          "lastCharacterName": "CharacterName",
          "online": {}
        },
        "price": {
          "exchange": { "currency": "divine", "amount": 1 },
          "item": { "currency": "chaos", "amount": 200, "stock": 500 }
        }
      }
    }
  },
  "total": 42
}
```

---

### Rate Limits

The API enforces rate limits communicated via `x-rate-limit-*` response headers. awakened-poe-trade observes:

- **Search:** 1 request per 5 seconds
- **Exchange:** 1 request per 5 seconds
- **Fetch:** 1 request per 5 seconds

---

### Source Reference

Findings derived from tracing awakened-poe-trade's price check flow:

- `renderer/src/web/price-check/trade/pathofexile-trade.ts` — trade search + fetch
- `renderer/src/web/price-check/trade/pathofexile-bulk.ts` — bulk/exchange
- `renderer/src/web/price-check/trade/common.ts` — rate limiting
- `renderer/src/web/Config.ts` — region/endpoint configuration
