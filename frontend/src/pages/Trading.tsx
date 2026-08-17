import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { apiFetch, getAuthHeaders } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import OrderBook from '../components/OrderBook'
import TradeHistory from '../components/TradeHistory'
import PriceChart from '../components/PriceChart'

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
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  useEffect(() => {
    setError(null)
    setSuccess(null)
  }, [side, type])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const body: Record<string, unknown> = { symbol, side, type, quantity }
    if (type === 'LIMIT') body.price = price

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
      setHistoryRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order submission failed')
    } finally {
      setLoading(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    color: 'var(--text-dim)',
    marginBottom: '6px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #2b3139',
    background: '#0b0e11',
    color: '#eaecef',
    fontSize: '14px',
  }

  const successMessage =
    success &&
    (success.status === 'CANCELLED'
      ? `Market order cancelled: no matching ${side === 'BUY' ? 'sell' : 'buy'} orders were resting on the book to fill against. Market orders only fill against existing liquidity; try a limit order instead, or place one on the opposite side first.`
      : `Order ${success.status.toLowerCase()}: ${success.side} ${success.quantity} ${success.symbol}`)

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <h1>Trading</h1>


      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '2 1 700px', minWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <PriceChart symbol={symbol} />
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
              <OrderBook symbol={symbol} token={token} />
            </div>
            <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
              <TradeHistory token={token} refreshKey={historyRefreshKey} />
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div>
            <label style={labelStyle}>Symbol</label>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={inputStyle}>
              <option value="BTC-USD">BTC-USD</option>
              <option value="ETH-USD">ETH-USD</option>
              <option value="SOL-USD">SOL-USD</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setSide('BUY')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid ' + (side === 'BUY' ? 'var(--buy)' : '#2b3139'),
                background: side === 'BUY' ? 'var(--buy)' : 'transparent',
                color: side === 'BUY' ? '#0b0e11' : 'var(--text-dim)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSide('SELL')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid ' + (side === 'SELL' ? 'var(--sell)' : '#2b3139'),
                background: side === 'SELL' ? 'var(--sell)' : 'transparent',
                color: side === 'SELL' ? '#0b0e11' : 'var(--text-dim)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sell
            </button>
          </div>

          <div>
            <label style={labelStyle}>Order Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as OrderType)} style={inputStyle}>
              <option value="LIMIT">Limit</option>
              <option value="MARKET">Market</option>
            </select>
            {type === 'MARKET' && (
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '6px', lineHeight: 1.4 }}>
                Market orders only fill against existing resting orders on the opposite side. If the book has no
                liquidity to match against, the order will be cancelled instead of filled.
              </p>
            )}
          </div>

          {type === 'LIMIT' && (
            <div>
              <label style={labelStyle}>Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Quantity</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.0000"
              required
              style={inputStyle}
            />
          </div>

          {error && <p style={{ color: 'var(--sell)', margin: 0, fontSize: '13px' }}>{error}</p>}
          {success && (
            <p
              style={{
                color: success.status === 'CANCELLED' ? '#f0b90b' : 'var(--buy)',
                margin: 0,
                fontSize: '13px',
                lineHeight: 1.4,
              }}
            >
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px',
              borderRadius: '6px',
              border: 'none',
              background: side === 'BUY' ? 'var(--buy)' : 'var(--sell)',
              color: '#0b0e11',
              fontWeight: 700,
              fontSize: '15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Placing...' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${symbol}`}
          </button>
        </form>
      </div>
    </div>
  )
}