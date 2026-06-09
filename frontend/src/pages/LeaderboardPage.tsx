import { useEffect, useState } from 'react'
import './LeaderboardPage.css'

interface LeaderboardEntry {
  ggg_account_name: string
  total_chaos: number
  taken_at: string
  league: string
}

interface LeaderboardData {
  league: string
  entries: LeaderboardEntry[]
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.ok ? r.json() as Promise<LeaderboardData> : null)
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h1 className="leaderboard-title">Leaderboard</h1>
        {data?.league && <span className="leaderboard-league">{data.league}</span>}
      </div>

      {(!data || data.entries.length === 0) ? (
        <p className="leaderboard-hint">
          No data yet — wealth snapshots are taken hourly for logged-in users.
        </p>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Account</th>
              <th>Wealth</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry, i) => (
              <tr key={entry.ggg_account_name}>
                <td className="rank">{i + 1}</td>
                <td>{entry.ggg_account_name}</td>
                <td className="chaos-value">{entry.total_chaos.toFixed(1)}c</td>
                <td className="timestamp">{new Date(entry.taken_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
