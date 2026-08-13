import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const FLASK_API_BASE = 'http://localhost:5000'

export default function ChatWidget() {
  const token = useAuthStore((s) => s.token)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, open])

  if (!token) return null // only show once logged in; the backend requires a JWT anyway

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    setError(null)

    try {
      const res = await fetch(`${FLASK_API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          history: messages, // prior turns, not including this one -- backend appends it
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Request failed: ${res.status}`)
      }

      setMessages([...nextMessages, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the trading assistant')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1000 }}>
      {open && (
        <div
          style={{
            width: '320px',
            height: '420px',
            marginBottom: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #333',
              fontWeight: 600,
              color: '#e5e5e5',
            }}
          >
            OpenEx Assistant
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {messages.length === 0 && (
              <p style={{ color: '#666', fontSize: '0.9rem' }}>
                Ask about your balance, orders, or how limit and market orders work.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  background: m.role === 'user' ? '#1e3a2f' : '#1e1e1e',
                  color: '#e5e5e5',
                }}
              >
                {m.content}
              </div>
            ))}
            {sending && <p style={{ color: '#666', fontSize: '0.85rem' }}>Thinking...</p>}
            {error && <p style={{ color: 'salmon', fontSize: '0.85rem' }}>{error}</p>}
          </div>

          <form onSubmit={sendMessage} style={{ display: 'flex', borderTop: '1px solid #333' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the assistant..."
              disabled={sending}
              style={{
                flex: 1,
                padding: '0.6rem 0.75rem',
                background: '#111',
                color: '#e5e5e5',
                border: 'none',
                outline: 'none',
              }}
            />
            <button type="submit" disabled={sending || !input.trim()} style={{ padding: '0 1rem' }}>
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'lightgreen',
          color: '#000',
          border: 'none',
          fontSize: '1.4rem',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  )
}