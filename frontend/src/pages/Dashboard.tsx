import { useEffect, useState } from 'react'
import { apiFetch, getAuthHeaders } from '../lib/api'
import { useAuthStore } from '../store/authStore'

interface Wallet {
  currency: string
  balance: string
}

interface OrderHistoryItem {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  type: 'LIMIT' | 'MARKET'
  price: string | null
  quantity: string
  remainingQuantity: string
  status: string
  createdAt: string
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

  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(true)

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

  async function loadOrders() {
    try {
      const data = await apiFetch('/api/orders', {
        headers: getAuthHeaders(token),
      })
      setOrders(data ?? [])
      setOrdersError(null)
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    loadWallets()
    loadOrders()
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

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2.4rem', textAlign: 'center', marginBottom: '2rem' }}>Dashboard</h1>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>
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

          <h2 style={{ marginTop: '2.5rem', fontSize: '1.6rem' }}>Your Orders</h2>
          {ordersLoading && <p style={{ fontSize: '1.05rem' }}>Loading orders...</p>}
          {ordersError && <p style={{ color: 'red', fontSize: '1.05rem' }}>{ordersError}</p>}
          {!ordersLoading && !ordersError && orders.length === 0 && (
            <p style={{ fontSize: '1.05rem', color: '#848e9c' }}>No orders yet.</p>
          )}
          {!ordersLoading && !ordersError && orders.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2b3139' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.4rem', color: '#848e9c', fontWeight: 500 }}>Pair</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.4rem', color: '#848e9c', fontWeight: 500 }}>Type</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.4rem', color: '#848e9c', fontWeight: 500 }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.4rem', color: '#848e9c', fontWeight: 500 }}>Price</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.4rem', color: '#848e9c', fontWeight: 500 }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.4rem', color: '#848e9c', fontWeight: 500 }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #2b3139' }}>
                      <td style={{ padding: '0.6rem 0.4rem', fontWeight: 700, color: o.side === 'BUY' ? 'var(--buy)' : 'var(--sell)' }}>
                        {o.side} {o.symbol}
                      </td>
                      <td style={{ padding: '0.6rem 0.4rem', color: '#848e9c' }}>{o.type}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right', color: '#848e9c' }}>{o.quantity}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right', color: '#848e9c' }}>
                        {o.price ? `${CURRENCY_SYMBOLS['USD']}${o.price}` : '-'}
                      </td>
                      <td style={{ padding: '0.6rem 0.4rem', color: '#848e9c' }}>{o.status}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right', color: '#848e9c', fontSize: '0.8rem' }}>
                        {formatTime(o.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}