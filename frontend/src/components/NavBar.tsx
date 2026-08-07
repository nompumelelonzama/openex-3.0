import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function NavBar() {
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav style={{ display: 'flex', gap: '1.5rem', padding: '1rem', borderBottom: '1px solid #333', alignItems: 'center' }}>
      <Link to="/">Dashboard</Link>
      <Link to="/trading">Trading</Link>
      {!token && <Link to="/login">Login</Link>}
      {token && (
        <button onClick={handleLogout} style={{ marginLeft: 'auto' }}>
          Log Out
        </button>
      )}
    </nav>
  )
}