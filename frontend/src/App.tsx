import { Routes, Route, NavLink } from 'react-router-dom'
import GuidePage from './pages/GuidePage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import LeaderboardPage from './pages/LeaderboardPage.tsx'
import { useAuth } from './hooks/useAuth.ts'
import './App.css'

function logout() {
  fetch('/auth/logout', { method: 'POST' }).then(() => window.location.reload())
}

export default function App() {
  const { user, loading } = useAuth()

  return (
    <div className="app">
      <header className="site-header">
        <img src="/bufo-wants-divine.png" alt="" className="site-logo" />
        <span className="site-title">Competitive Exile</span>
        <nav className="site-nav">
          <NavLink to="/" end>Guide</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
        </nav>
        {!loading && (
          user
            ? <div className="auth-user">
                <span className="auth-username">{user.accountName}</span>
                <button className="logout-btn" onClick={logout}>Logout</button>
              </div>
            : <button className="login-btn" onClick={() => window.location.href = '/auth/login'}>
                Login with PoE
              </button>
        )}
      </header>
      <main className="site-main">
        <Routes>
          <Route path="/" element={<GuidePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
      </main>
      <footer className="site-footer">
        This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
      </footer>
    </div>
  )
}
