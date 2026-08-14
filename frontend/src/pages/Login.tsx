import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const setToken = useAuthStore((s) => s.setToken)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setToken(data.token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '16px 18px',
    fontSize: '18px',
    borderRadius: '8px',
    border: '1px solid #2b3139',
    background: '#0b0e11',
    color: '#eaecef',
  }

  const buttonStyle: React.CSSProperties = {
    padding: '16px',
    fontSize: '18px',
    fontWeight: 700,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--buy)',
    color: '#0b0e11',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
  }

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <h1 style={{ fontSize: '2.4rem', textAlign: 'center', marginBottom: '1.5rem' }}>Login</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          {error && <p style={{ color: 'red', fontSize: '1.05rem', textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '1.05rem' }}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}
