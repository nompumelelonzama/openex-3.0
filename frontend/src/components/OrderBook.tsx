import { useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { apiFetch, getAuthHeaders } from '../lib/api'

interface PriceLevel {
  price: string
  quantity: string
  orderCount: number
}

interface OrderBookSnapshot {
  symbol: string
  bids: PriceLevel[]
  asks: PriceLevel[]
  timestamp: string
}

export default function OrderBook({ symbol, token }: { symbol: string; token: string | null }) {
  const [book, setBook] = useState<OrderBookSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const clientRef = useRef<Client | null>(null)

  useEffect(() => {
    let cancelled = false

    apiFetch(`/api/orderbook/${symbol}`, { headers: getAuthHeaders(token) })
      .then((data) => {
        if (!cancelled) setBook(data)
      })
      .catch(() => {})

    const client = new Client({
      webSocketFactory: () => new SockJS((import.meta.env.VITE_API_BASE || 'http://localhost:8080') + '/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)
        client.subscribe(`/topic/orderbook/${symbol}`, (message) => {
          const snapshot: OrderBookSnapshot = JSON.parse(message.body)
          setBook(snapshot)
        })
      },
      onDisconnect: () => setConnected(false),
      onStompError: (frame) => {
        console.error('STOMP error', frame.headers['message'], frame.body)
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      cancelled = true
      client.deactivate()
    }
  }, [symbol])

  const depth = 8
  const asksToShow = book ? [...book.asks].slice(0, depth).reverse() : []
  const bidsToShow = book ? book.bids.slice(0, depth) : []

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>{symbol} Order Book</h2>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-dim)' }}>
          <span className={`live-dot ${connected ? '' : 'offline'}`} />
          {connected ? 'Live' : 'Connecting...'}
        </span>
      </div>

      {!book && <p style={{ color: 'var(--text-dim)' }}>Loading order book...</p>}

      {book && (
        <table>
          <thead>
            <tr>
              <th>Price</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {asksToShow.length === 0 && (
              <tr>
                <td colSpan={2} style={{ color: 'var(--text-dim)', textAlign: 'center' }}>No asks</td>
              </tr>
            )}
            {asksToShow.map((level) => (
              <tr key={`ask-${level.price}`}>
                <td className="num" style={{ color: 'var(--sell)' }}>{level.price}</td>
                <td className="num" style={{ textAlign: 'right' }}>{level.quantity}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ borderBottom: '1px solid var(--border)', padding: '2px 0' }} />
            </tr>
            {bidsToShow.length === 0 && (
              <tr>
                <td colSpan={2} style={{ color: 'var(--text-dim)', textAlign: 'center' }}>No bids</td>
              </tr>
            )}
            {bidsToShow.map((level) => (
              <tr key={`bid-${level.price}`}>
                <td className="num" style={{ color: 'var(--buy)' }}>{level.price}</td>
                <td className="num" style={{ textAlign: 'right' }}>{level.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
