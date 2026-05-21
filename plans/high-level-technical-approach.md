# Competitive Exile — Feasibility & Implementation Plan

## Context
Build a third-party Path of E``xile site focused on the competitive/social angle of wealth accumulation: show each OAuth'd player's total assets over time, and surface a leaderboard of "currency per hour" across a friend group. Existing tools (Wealthy Exile) already break down stash tabs in detail — this site leans into comparison and pacing, not item-by-item breakdowns.

---

## Feasibility Verdict: Yes, buildable with known constraints

### What the GGG API gives us

| Need | Endpoint | Scope | Notes |
|---|---|---|---|
| Character gear + inventory | `GET /character/<realm>/<name>` | `account:characters` | Full item data including equipment, inventory |
| All stash tabs + items | `GET /stash/<realm>/<league>` | `account:stashes` | Includes sub-tabs; raw item list per tab |
| Current league info | `GET /league` | `service:leagues` | Identify active league for scoping requests |
| OAuth login | Authorization Code + PKCE | — | Confidential client (server-side); 28-day access tokens, 90-day refresh tokens |

### What poe.ninja gives us (confirmed from exilence-next source)
poe.ninja is the right pricing source for MVP — no auth, no rate limit concerns, pre-aggregated per-league prices. Two public endpoints:

```
GET https://poe.ninja/api/data/currencyoverview?league={league}&type={type}
GET https://poe.ninja/api/data/itemoverview?league={league}&type={type}
```

**Currency types** (`currencyoverview`): `Currency`, `Fragment`

**Item types** (`itemoverview`, one request each): `Oil`, `Incubator`, `Scarab`, `Fossil`, `Resonator`, `Essence`, `DivinationCard`, `SkillGem`, `UniqueMap`, `Map`, `UniqueJewel`, `UniqueFlask`, `UniqueWeapon`, `UniqueArmour`, `UniqueAccessory`, `DeliriumOrb`, `Beast`, `Vial`, `Invitation`, `Artifact`, `BlightedMap`, `Watchstone`, `Prophecy`

Each response includes a `chaosValue` field per item — multiply by stack quantity and sum. No per-item trade searches needed. Exilence Next caches these results for **60 minutes** and only re-fetches once per hour.

**Limitations**: Rare/magic items are not priced (ninja only covers league staples and uniques). For a wealth tracker focused on stash currency and stackables, this covers the vast majority of value.

**Trade site API (deprioritized)**: `POST /api/trade/exchange/{leagueId}` and the search/fetch flow exist and are used by tools like awakened-poe-trade, but they are reverse-engineered (not officially published), have a 1 req/5s rate limit, and are unnecessary given ninja covers the same data more conveniently. Revisit only if ninja proves insufficient.

### What's NOT directly available
- **In-game time played per league**: The `account:characters` endpoint returns experience, level, and class — no explicit "time played" field. This is an open question. Mitigation: track *real elapsed time* between snapshots (first auth = T0, each subsequent poll = Tn). This is arguably more relevant for the site's purpose anyway.
- **Rare/magic item pricing**: poe.ninja does not price these. Acceptable for MVP since the bulk of stash value is currency, scarabs, and uniques.

### TOS / Data Storage
- Storing OAuth tokens server-side is **required** by GGG's own docs ("refresh tokens must always be stored securely server-side").
- Storing wealth snapshots for consenting OAuth users is **standard practice** — Exilence Next, poestack.com, and others do this. No explicit prohibition found.
- poe.ninja is a community service with no published TOS restrictions on API usage. Be polite (cache aggressively, don't hammer).
- **Leaderboard**: Only show data for users who explicitly OAuth'd to the site. No scraping of public profiles without consent. This should be fine.

---

## Architecture

### Tech Stack
- **Backend**: Node.js + Express (or Python + FastAPI) — confidential OAuth client requires server-side secret
- **Database**: PostgreSQL — store users, wealth snapshots (timestamped), refresh tokens
- **Frontend**: Next.js (SSR friendly for auth callbacks) or React + Vite
- **Job Queue**: Simple cron or BullMQ for periodic snapshot polling per user

### Core Data Model
```
users: id, ggg_account_name, ggg_uuid, access_token, refresh_token, token_expiry, created_at
snapshots: id, user_id, league, total_value_chaos, taken_at
  (total_value_chaos = sum of: stash currency value + stash item value + equipped gear value)
```

### Wealth Calculation Flow (per snapshot)

1. **Fetch active league** — `GET /league?type=main` to get current league name
2. **Fetch stash list** — `GET /stash/<realm>/<league>` → list of tab IDs
3. **Fetch each stash tab** — `GET /stash/<realm>/<league>/<stash_id>` → items
4. **Fetch characters** — `GET /character/<realm>` → list → fetch equipped items per character
5. **Fetch poe.ninja prices** — ~25 requests to ninja (`currencyoverview` + `itemoverview` per category); cache result for 60 min and reuse across snapshots
6. **Value items** — look up each item's `chaosValue` from ninja cache, multiply by stack quantity
7. **Sum → store snapshot** with timestamp

### Rate Limit Reality Check
For a user with 20 stash tabs:
- Stash fetches: ~20 requests to GGG API (no published rate limit, but be conservative: ~1/s) = ~20 seconds
- Pricing: ninja prices are fetched once per hour and shared across all users/snapshots — **not per-snapshot cost**

**Implication**: Per-snapshot cost is almost entirely the GGG stash fetches (~20s for 20 tabs). Pricing is free after the first ninja fetch of the hour. Poll on a schedule (e.g., every 30 min) and serve cached snapshot data. Let users manually trigger a refresh with a cooldown.

### "Currency Per Hour" Calculation
```
wealth_delta = snapshot_N.total_value_chaos - snapshot_0.total_value_chaos
time_delta_hours = (snapshot_N.taken_at - snapshot_0.taken_at) / 3600
currency_per_hour = wealth_delta / time_delta_hours
```
Use wall-clock time between snapshots (not in-game time, since that's not available from the API).

### Leaderboard
Query all users' most recent snapshot + their session-start snapshot, compute per-hour rate for each, rank and display. Scope to "current league" to keep it relevant.

---

## Implementation Phases

### Phase 1 — OAuth + User Auth
- Register confidential client with GGG (requires submitting an application)
- Implement Authorization Code + PKCE flow
- Store tokens securely (encrypted at rest in DB)
- Scopes needed: `account:profile`, `account:characters`, `account:stashes`, `service:leagues`

### Phase 2 — Snapshot Engine
- Implement GGG API fetching (stash + characters)
- Implement poe.ninja pricing (~25 requests, cached 60 min, shared across all users)
- Store snapshots in DB
- Background job: poll each user on schedule

### Phase 3 — Frontend
- Auth flow (login with PoE button)
- Personal dashboard: wealth over time chart (snapshots → line graph)
- Leaderboard: table of friends sorted by currency/hour
- Manual refresh button (with cooldown indicator)

### Phase 4 — Extended Features (from README)
- Static "currency making" guide section
- Twitch stream scraping for hot items/builds (separate complexity — needs Twitch API or scraping)

---

## Decisions Made
1. **Time tracking**: Use wall-clock elapsed time between snapshots (in-game time not available from API).
2. **Gear valuation**: Currency/stackables only for MVP. Gear pricing added in a later phase.
3. **Scale**: Personal / small friend group. Local server + ngrok is acceptable; no need for production hosting infrastructure upfront.
4. **GGG client registration**: Required step — must apply for a confidential OAuth client before OAuth flows work.

---

## Critical Files to Create
- `server/` — Express/FastAPI backend
    - `auth/oauth.ts` — GGG OAuth flow
    - `services/ggg-api.ts` — stash + character fetching
    - `services/poe-ninja.ts` — pricing via poe.ninja itemoverview + currencyoverview
    - `services/snapshot.ts` — wealth calculation + DB write
    - `jobs/poll.ts` — scheduled polling per user
- `db/schema.sql` — users + snapshots tables
- `frontend/` — Next.js or React app
    - `pages/dashboard.tsx` — personal wealth chart
    - `pages/leaderboard.tsx` — friends comparison

---

## Verification Plan
1. OAuth flow: manually log in, verify tokens stored, verify profile fetch works
2. Snapshot: trigger manual refresh, verify stash items fetched and valued, verify snapshot written to DB
3. Currency/hour: create two snapshots 5+ minutes apart, verify math
4. Leaderboard: add a second test account, verify both appear ranked correctly
