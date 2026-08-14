import { useEffect, useState } from 'react'
import { apiFetch, getAuthHeaders } from '../lib/api'

interface Trade {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  price: string
  quantity: string
  createdAt: string
}

export default function TradeHistory({ token, refreshKey }: { token: string | null; refreshKey: number }) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    apiFetch('/api/trades', { headers: getAuthHeaders(token) })
      .then((data) => {
        if (!cancelled) {
          setTrades(data ?? [])
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load trade history')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, refreshKey])

  return (
    <div className="card" style={{ marginTop: '2rem' }}>
      <h2>Trade History</h2>
      {loading && <p style={{ color: 'var(--text-dim)' }}>Loading...</p>}
      {error && <p style={{ color: 'var(--sell)' }}>{error}</p>}
      {!loading && !error && trades.length === 0 && (
        <p style={{ color: 'var(--text-dim)' }}>No trades yet -- place an order to see it here once it fills.</p>
      )}
      {!loading && !error && trades.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Symbol</th>
              <th>Side</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id}>
                <td className="num" style={{ color: 'var(--text-dim)' }}>
                  {new Date(t.createdAt).toLocaleString()}
                </td>
                <td className="num">{t.symbol}</td>
                <td style={{ color: t.side === 'BUY' ? 'var(--buy)' : 'var(--sell)', fontWeight: 600 }}>{t.side}</td>
                <td className="num" style={{ textAlign: 'right' }}>{t.price}</td>
                <td className="num" style={{ textAlign: 'right' }}>{t.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}