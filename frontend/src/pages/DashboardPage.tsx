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

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<WealthData | null>(null)
  const [fetching, setFetching] = useState(false)
  const [snapshotPending, setSnapshotPending] = useState(false)

  useEffect(() => {
    if (!user) return
    setFetching(true)
    fetch('/api/wealth')
      .then(r => r.ok ? r.json() as Promise<WealthData> : null)
      .then(d => setData(d))
      .finally(() => setFetching(false))
  }, [user])

  function triggerSnapshot() {
    setSnapshotPending(true)
    fetch('/api/snapshot', { method: 'POST' })
      .then(r => r.json())
      .then(() => {
        // Poll for new data after a delay
        setTimeout(() => {
          fetch('/api/wealth')
            .then(r => r.ok ? r.json() as Promise<WealthData> : null)
            .then(d => setData(d))
            .finally(() => setSnapshotPending(false))
        }, 5000)
      })
      .catch(() => setSnapshotPending(false))
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
        <button
          className="snapshot-btn"
          onClick={triggerSnapshot}
          disabled={snapshotPending}
        >
          {snapshotPending ? 'Calculating…' : 'Refresh Now'}
        </button>
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
