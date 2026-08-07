import { useEffect, useState } from 'react'
import { apiFetch, getAuthHeaders } from '../lib/api'
import { useAuthStore } from '../store/authStore'

interface Wallet {
  currency: string
  balance: string
}

export default function Dashboard() {
  const token = useAuthStore((s) => s.token)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadWallets() {
      try {
        const data = await apiFetch('/api/wallets', {
          headers: getAuthHeaders(token),
        })
        if (!cancelled) setWallets(data ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load wallets')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadWallets()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      {loading && <p>Loading balances...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {wallets.map((w) => (
            <li key={w.currency} style={{ padding: '0.5rem 0', fontSize: '1.1rem' }}>
              <strong>{w.currency}</strong>: {w.balance}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}