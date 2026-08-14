import { useEffect, useState } from 'react'
import { apiFetch, getAuthHeaders } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import PriceChart from '../components/PriceChart'
import OrderHistory from '../components/OrderHistory'

interface Wallet {
  currency: string
  balance: string
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  BTC: '\u20BF',
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

  const selectStyle: React.CSSProperties = {
    padding: '14px 16px',
    fontSize: '17px',
    borderRadius: '8px',
    border: '1px solid #2b3139',
    background: '#0b0e11',
    color: '#eaecef',
  }

  const inputStyle: React.CSSProperties = {
    padding: '14px 16px 14px 34px',
    fontSize: '17px',
    borderRadius: '8px',
    border: '1px solid #2b3139',
    background: '#0b0e11',
    color: '#eaecef',
    flex: 1,
    width: '100%',
  }

  const buttonStyle: React.CSSProperties = {
    padding: '14px 28px',
    fontSize: '17px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--buy)',
    color: '#0b0e11',
    cursor: depositing ? 'not-allowed' : 'pointer',
    opacity: depositing ? 0.6 : 1,
  }

  const depositStep = depositCurrency === 'BTC' ? '0.00000001' : '0.01'
  const depositPlaceholder = depositCurrency === 'BTC' ? '0.00000000' : '0.00'

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2.4rem', textAlign: 'center', marginBottom: '2rem' }}>Dashboard</h1>

      <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px', minWidth: '340px', maxWidth: '480px' }}>
          {loading && <p style={{ fontSize: '1.1rem' }}>Loading balances...</p>}
          {error && <p style={{ color: 'red', fontSize: '1.1rem' }}>{error}</p>}

          {!loading && !error && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0' }}>
              {wallets.map((w) => (
                <li
                  key={w.currency}
                  style={{
                    padding: '1rem',
                    fontSize: '1.3rem',
                    borderBottom: '1px solid #2b3139',
                  }}
                >
                  <strong>{w.currency}</strong>: {CURRENCY_SYMBOLS[w.currency] ?? ''}
                  {w.balance}
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ marginTop: '1.5rem', fontSize: '1.6rem' }}>Deposit (Simulated Funds)</h2>
          <form
            onSubmit={handleDeposit}
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginTop: '1rem',
            }}
          >
            <select value={depositCurrency} onChange={(e) => setDepositCurrency(e.target.value)} style={selectStyle}>
              <option value="USD">USD</option>
              <option value="BTC">BTC</option>
            </select>
            <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '17px',
                  color: '#848e9c',
                  pointerEvents: 'none',
                }}
              >
                {CURRENCY_SYMBOLS[depositCurrency] ?? ''}
              </span>
              <input
                type="number"
                step={depositStep}
                placeholder={depositPlaceholder}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <button type="submit" disabled={depositing} style={buttonStyle}>
              {depositing ? 'Depositing...' : 'Deposit'}
            </button>
          </form>
          {depositError && (
            <p style={{ color: 'red', fontSize: '1.1rem', marginTop: '0.75rem' }}>{depositError}</p>
          )}

          <OrderHistory token={token} />
        </div>

        <div style={{ flex: '2 1 600px', minWidth: '480px' }}>
          <PriceChart symbol="BTC-USD" />
        </div>
      </div>
    </div>
  )
}