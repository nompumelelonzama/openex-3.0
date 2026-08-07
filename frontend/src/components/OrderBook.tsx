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

    // Initial snapshot via REST so the book isn't empty while the socket connects
    // Initial snapshot via REST so the book isn't empty while the socket connects
    apiFetch(`/api/orderbook/${symbol}`, { headers: getAuthHeaders(token) })
      .then((data) => {
        if (!cancelled) setBook(data)
      })
      .catch(() => {
        // non-fatal; live feed will populate it once connected
      })

    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
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

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>
        Order Book: {symbol} <span style={{ fontSize: '0.8rem', color: connected ? 'lightgreen' : 'gray' }}>
          {connected ? '[live]' : '[connecting]'}
        </span>
      </h2>
      {!book && <p>Loading order book...</p>}
      {book && (
        <div style={{ display: 'flex', gap: '2rem', maxWidth: '600px' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ color: 'lightgreen' }}>Bids</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {book.bids.map((level) => (
                  <tr key={level.price}>
                    <td style={{ color: 'lightgreen' }}>{level.price}</td>
                    <td style={{ textAlign: 'right' }}>{level.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ color: 'salmon' }}>Asks</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {book.asks.map((level) => (
                  <tr key={level.price}>
                    <td style={{ color: 'salmon' }}>{level.price}</td>
                    <td style={{ textAlign: 'right' }}>{level.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}