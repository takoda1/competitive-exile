import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.ts'
import './DashboardPage.css'


interface Snapshot {
  id: number
  total_chaos: number
  taken_at: string
  league: string
}

interface WealthData {
  league: string
  snapshots: Snapshot[]
}

interface GGGLeague {
  id: string
  realm?: string
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<WealthData | null>(null)
  const [fetching, setFetching] = useState(false)
  const [snapshotPending, setSnapshotPending] = useState(false)
  const [leagues, setLeagues] = useState<GGGLeague[]>([])
  const [selectedLeague, setSelectedLeague] = useState<string | null>(user?.selectedLeague ?? null)

  useEffect(() => {
    if (!user) return
    setSelectedLeague(user.selectedLeague)
    fetch('/api/leagues')
      .then(r => r.ok ? r.json() as Promise<{ leagues: GGGLeague[] }> : null)
      .then(d => { if (d) setLeagues(d.leagues) })
  }, [user])

  function loadWealth() {
    setFetching(true)
    fetch('/api/wealth')
      .then(r => r.ok ? r.json() as Promise<WealthData> : null)
      .then(d => setData(d))
      .finally(() => setFetching(false))
  }

  useEffect(() => {
    if (!user) return
    loadWealth()
  }, [user])

  function changeLeague(league: string) {
    setSelectedLeague(league)
    fetch('/api/league', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league }),
    }).then(() => loadWealth())
  }

  function triggerSnapshot() {
    setSnapshotPending(true)
    const triggeredAt = Date.now()
    const prevId = data?.snapshots[0]?.id ?? null

    fetch('/api/snapshot', { method: 'POST' }).catch(() => {
      setSnapshotPending(false)
    })

    // Poll every 8s until a snapshot newer than the trigger appears, or 5 min timeout
    const POLL_MS = 8000
    const TIMEOUT_MS = 5 * 60 * 1000

    function poll() {
      if (Date.now() - triggeredAt > TIMEOUT_MS) {
        setSnapshotPending(false)
        return
      }
      setTimeout(() => {
        fetch('/api/wealth')
          .then(r => r.ok ? r.json() as Promise<WealthData> : null)
          .then(d => {
            if (d && d.snapshots[0]?.id !== prevId) {
              setData(d)
              setSnapshotPending(false)
            } else {
              poll()
            }
          })
          .catch(() => poll())
      }, POLL_MS)
    }
    poll()
  }

  if (authLoading) return null

  if (!user) {
    return (
      <div className="dashboard">
        <p className="dashboard-hint">Log in with PoE to see your wealth dashboard.</p>
      </div>
    )
  }

  const latest = data?.snapshots[0]

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Your Wealth</h1>
        <div className="dashboard-controls">
          {leagues.length > 0 && (
            <select
              className="league-select"
              value={selectedLeague ?? ''}
              onChange={e => changeLeague(e.target.value)}
            >
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.id}</option>
              ))}
            </select>
          )}
          <button
            className="snapshot-btn"
            onClick={triggerSnapshot}
            disabled={snapshotPending}
          >
            {snapshotPending ? 'Calculating…' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {fetching && <p className="dashboard-hint">Loading…</p>}

      {!fetching && !latest && (
        <p className="dashboard-hint">
          No snapshots yet. Hit "Refresh Now" to calculate your wealth, or wait for the hourly job.
        </p>
      )}

      {latest && (
        <>
          <div className="wealth-card">
            <div className="wealth-value">{latest.total_chaos.toFixed(1)}<span className="wealth-unit">c</span></div>
            <div className="wealth-league">{data!.league}</div>
            <div className="wealth-time">Last updated {new Date(latest.taken_at).toLocaleString()}</div>
          </div>

          {data!.snapshots.length > 1 && (
            <div className="snapshot-history">
              <h2>History</h2>
              <table className="snapshot-table">
                <thead>
                  <tr><th>Time</th><th>Chaos</th></tr>
                </thead>
                <tbody>
                  {data!.snapshots.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.taken_at).toLocaleString()}</td>
                      <td>{s.total_chaos.toFixed(1)}c</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
