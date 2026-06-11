import type { FastifyInstance } from 'fastify'
import { getSnapshots, getLeaderboard } from '../db/snapshots.js'
import { takeSnapshotForUser } from '../jobs/snapshot.js'
import { USER_AGENT, ERROR_BODY_PREVIEW_CHARS } from '../lib/constants.js'
import { getAccountLeagues } from '../lib/ggg-api.js'
import { updateSelectedLeague } from '../db/users.js'

export default async function apiRoutes(app: FastifyInstance) {
  // Current user's wealth history
  app.get('/wealth', { preHandler: [app.authenticate] }, async (req) => {
    const user = req.user!
    const league = user.selected_league ?? process.env.DEFAULT_LEAGUE ?? ''
    const snapshots = getSnapshots(user.id, league)
    return { league, snapshots }
  })

  // Trigger a manual snapshot for the current user
  app.post('/snapshot', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = req.user!
    const league = user.selected_league ?? process.env.DEFAULT_LEAGUE
    if (!league) return reply.code(400).send({ error: 'No league configured' })

    // Fire and return immediately — calculation takes a while
    takeSnapshotForUser(user.id, league).catch(err =>
      console.error(`[snapshot] Manual trigger failed for ${user.ggg_account_name}:`, err)
    )

    return { status: 'calculating', league }
  })

  // List leagues for the authenticated user (for league picker)
  app.get('/leagues', { preHandler: [app.authenticate] }, async (req) => {
    const { getValidAccessToken } = await import('../lib/token-refresh.js')
    const token = await getValidAccessToken(req.user!)
    const leagues = await getAccountLeagues(token)
    return { leagues }
  })

  // Update the user's selected league
  app.put<{ Body: { league: string } }>('/league', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { league } = req.body
    if (!league || typeof league !== 'string') {
      return reply.code(400).send({ error: 'league is required' })
    }
    updateSelectedLeague(req.user!.id, league)
    return { league }
  })

  // Debug: probe stash and character endpoints to find correct path format
  app.get('/debug/stash', { preHandler: [app.authenticate] }, async (req) => {
    const { getValidAccessToken } = await import('../lib/token-refresh.js')
    const token = await getValidAccessToken(req.user!)
    const headers = { 'User-Agent': USER_AGENT, Authorization: `Bearer ${token}` }
    const probes = [
      'https://api.pathofexile.com/stash/Standard',
      'https://api.pathofexile.com/stash/Mirage',
      'https://api.pathofexile.com/stash/Solo%20Self-Found',
    ]
    const results: Record<string, unknown> = {}
    for (const url of probes) {
      const res = await fetch(url, { headers })
      const text = await res.text()
      results[url] = { status: res.status, body: text.slice(0, ERROR_BODY_PREVIEW_CHARS) }
    }
    return results
  })

  // Debug: probe account:leagues and account:profile endpoints
  app.get('/debug/leagues', { preHandler: [app.authenticate] }, async (req) => {
    const { getValidAccessToken } = await import('../lib/token-refresh.js')
    const token = await getValidAccessToken(req.user!)
    const headers = { 'User-Agent': USER_AGENT, Authorization: `Bearer ${token}` }
    const probes = [
      'https://api.pathofexile.com/account/leagues',
      'https://api.pathofexile.com/profile',
    ]
    const results: Record<string, unknown> = {}
    for (const url of probes) {
      const res = await fetch(url, { headers })
      try {
        results[url] = { status: res.status, body: await res.json() }
      } catch {
        results[url] = { status: res.status, body: await res.text() }
      }
    }
    return results
  })

  // Leaderboard — latest snapshot per user for the active league
  app.get('/leaderboard', async (req) => {
    const league = (req.query as { league?: string }).league ?? process.env.DEFAULT_LEAGUE ?? ''
    return { league, entries: getLeaderboard(league) }
  })
}
