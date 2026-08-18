import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { decodeJwtEmail } from '../lib/jwt'

const RETURNING_USER_KEY = 'openex_has_logged_in_before'

export default function NavBar() {
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [apiOnline, setApiOnline] = useState(false)
  const [welcomeBack, setWelcomeBack] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkHealth() {
      try {
        const res = await fetch((import.meta.env.VITE_API_BASE || 'http://localhost:8080') + '/actuator/health')
        if (!cancelled) setApiOnline(res.ok)
      } catch {
        if (!cancelled) setApiOnline(false)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 10000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    const hasLoggedInBefore = localStorage.getItem(RETURNING_USER_KEY) === 'true'
    if (hasLoggedInBefore) {
      setWelcomeBack(true)
    } else {
      localStorage.setItem(RETURNING_USER_KEY, 'true')
    }
  }, [token])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const email = decodeJwtEmail(token)

  return (
    <nav
      style={{
        display: 'flex',
        gap: '1.5rem',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid var(--border)',
        alignItems: 'center',
        background: 'var(--surface)',
      }}
    >
      <Link to="/">Dashboard</Link>
      <Link to="/trading">Trading</Link>

      {token && welcomeBack && email && (
        <span style={{ color: 'var(--text-dim)', fontSize: '14px' }}>Welcome back, {email}</span>
      )}

      <span
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: 'var(--text-dim)',
        }}
      >
        <span className={`live-dot ${apiOnline ? '' : 'offline'}`} />
        {apiOnline ? 'API Online' : 'API Offline'}
      </span>

      {!token && <Link to="/login">Login</Link>}
      {token && (
        <button onClick={handleLogout} className="btn">
          Log Out
        </button>
      )}
    </nav>
  )
}
