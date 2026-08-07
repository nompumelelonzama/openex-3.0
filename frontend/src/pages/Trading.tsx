import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { apiFetch, getAuthHeaders } from '../lib/api'
import { useAuthStore } from '../store/authStore'

type Side = 'BUY' | 'SELL'
type OrderType = 'LIMIT' | 'MARKET'

interface OrderResponse {
  id: string
  symbol: string
  side: Side
  type: OrderType
  price: string | null
  quantity: string
  remainingQuantity: string
  status: string
}

export default function Trading() {
  const token = useAuthStore((s) => s.token)
  const [symbol, setSymbol] = useState('BTC-USD')
  const [side, setSide] = useState<Side>('BUY')
  const [type, setType] = useState<OrderType>('LIMIT')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<OrderResponse | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const body: Record<string, unknown> = {
      symbol,
      side,
      type,
      quantity,
    }
    if (type === 'LIMIT') {
      body.price = price
    }

    try {
      const data = await apiFetch('/api/orders', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token),
          'Idempotency-Key': uuidv4(),
        },
        body: JSON.stringify(body),
      })
      setSuccess(data)
      setQuantity('')
      setPrice('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order submission failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '400px' }}>
      <h1>Trading</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label>
          Symbol
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} required />
        </label>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <label>
            <input type="radio" checked={side === 'BUY'} onChange={() => setSide('BUY')} /> Buy
          </label>
          <label>
            <input type="radio" checked={side === 'SELL'} onChange={() => setSide('SELL')} /> Sell
          </label>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <label>
            <input type="radio" checked={type === 'LIMIT'} onChange={() => setType('LIMIT')} /> Limit
          </label>
          <label>
            <input type="radio" checked={type === 'MARKET'} onChange={() => setType('MARKET')} /> Market
          </label>
        </div>

        {type === 'LIMIT' && (
          <label>
            Price
            <input
              type="number"
              step="0.00000001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </label>
        )}

        <label>
          Quantity
          <input
            type="number"
            step="0.00000001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>

        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && (
          <p style={{ color: 'lightgreen' }}>
            Order {success.status}: {success.side} {success.quantity} {success.symbol}
            {success.price ? ` @ ${success.price}` : ' (market)'}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : `Place ${side} Order`}
        </button>
      </form>
    </div>
  )
}