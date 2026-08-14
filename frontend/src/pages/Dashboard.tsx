import { useEffect, useState } from 'react'
import { apiFetch, getAuthHeaders } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import PriceChart from '../components/PriceChart'

interface Wallet {
  currency: string
  balance: string
}

export default function Dashboard() {
  const token = useAuthStore((s) => s.token)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [depositCurrency, setDepositCurrency] = useState('USD')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositError, setDepositError] = useState<string | null>(null)
  const [depositing, setDepositing] = useState(false)

  async function loadWallets() {
    try {
      const data = await apiFetch('/api/wallets', {
        headers: getAuthHeaders(token),
      })
      setWallets(data ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWallets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault()
    setDepositError(null)
    setDepositing(true)
    try {
      await apiFetch('/api/wallets/deposit', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ currency: depositCurrency, amount: depositAmount }),
      })
      setDepositAmount('')
      await loadWallets()
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : 'Deposit failed')
    } finally {
      setDepositing(false)
    }
  }

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

      <h2 style={{ marginTop: '2rem' }}>Deposit (Simulated Funds)</h2>
      <form onSubmit={handleDeposit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', maxWidth: '400px' }}>
        <select value={depositCurrency} onChange={(e) => setDepositCurrency(e.target.value)}>
          <option value="USD">USD</option>
          <option value="BTC">BTC</option>
        </select>
        <input
          type="number"
          step="0.00000001"
          placeholder="Amount"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          required
        />
        <button type="submit" disabled={depositing}>
          {depositing ? 'Depositing...' : 'Deposit'}
        </button>
      </form>
     {depositError && <p style={{ color: 'red' }}>{depositError}</p>}

      <PriceChart symbol="BTC-USD" />
    </div>
  )
}
