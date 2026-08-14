import { useEffect, useState } from 'react'
import { apiFetch, getAuthHeaders } from '../lib/api'

interface Order {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  type: 'MARKET' | 'LIMIT'
  price: string | null
  quantity: string
  remainingQuantity: string
  status: string
  createdAt: string
}

export default function OrderHistory({ token }: { token: string | null }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    apiFetch('/api/orders', { headers: getAuthHeaders(token) })
      .then((data) => {
        if (!cancelled) {
          setOrders(data ?? [])
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load order history')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="card" style={{ marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.6rem' }}>Your Order History</h2>
      {loading && <p style={{ color: 'var(--text-dim)' }}>Loading...</p>}
      {error && <p style={{ color: 'var(--sell)' }}>{error}</p>}
      {!loading && !error && orders.length === 0 && (
        <p style={{ color: 'var(--text-dim)' }}>No orders yet -- place an order to see it here.</p>
      )}
      {!loading && !error && orders.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="num" style={{ color: 'var(--text-dim)' }}>
                  {new Date(o.createdAt).toLocaleString()}
                </td>
                <td className="num">{o.symbol}</td>
                <td style={{ color: o.side === 'BUY' ? 'var(--buy)' : 'var(--sell)', fontWeight: 600 }}>{o.side}</td>
                <td className="num">{o.type}</td>
                <td className="num" style={{ textAlign: 'right' }}>{o.price ?? '--'}</td>
                <td className="num" style={{ textAlign: 'right' }}>{o.quantity}</td>
                <td className="num">{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
