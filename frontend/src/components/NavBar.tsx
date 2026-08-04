import { Link } from 'react-router-dom'

export default function NavBar() {
  return (
    <nav style={{ display: 'flex', gap: '1.5rem', padding: '1rem', borderBottom: '1px solid #333' }}>
      <Link to="/">Dashboard</Link>
      <Link to="/trading">Trading</Link>
      <Link to="/login">Login</Link>
    </nav>
  )
}