import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { analyticsFetch } from '../lib/analyticsApi'

Chart.register(...registerables)

interface Tick {
  timestamp: string
  price: number
  ma_short: number
  ma_long: number
}

export default function PriceChart({ symbol }: { symbol: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceChangePct, setPriceChangePct] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadTicks() {
      try {
        const data = await analyticsFetch(`/api/market/ticks?symbol=${symbol}&limit=60`)
        if (cancelled || !canvasRef.current) return

        const ticks: Tick[] = data.ticks
        if (ticks.length === 0) return

        const latest = ticks[ticks.length - 1].price
        const first = ticks[0].price
        setCurrentPrice(latest)
        setPriceChangePct(((latest - first) / first) * 100)

        const labels = ticks.map((t) =>
          new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        )

        const up = latest >= first
        const lineColor = up ? '#0ecb81' : '#f6465d'

        if (!chartRef.current) {
          const ctx = canvasRef.current.getContext('2d')!
          const gradient = ctx.createLinearGradient(0, 0, 0, 260)
          gradient.addColorStop(0, up ? 'rgba(14, 203, 129, 0.25)' : 'rgba(246, 70, 93, 0.25)')
          gradient.addColorStop(1, 'rgba(14, 203, 129, 0)')

          chartRef.current = new Chart(canvasRef.current, {
            type: 'line',
            data: {
              labels,
              datasets: [
                {
                  label: 'Price',
                  data: ticks.map((t) => t.price),
                  borderColor: lineColor,
                  backgroundColor: gradient,
                  borderWidth: 2,
                  pointRadius: 0,
                  pointHitRadius: 12,
                  tension: 0.25,
                  fill: true,
                },
                {
                  label: 'MA (short)',
                  data: ticks.map((t) => t.ma_short),
                  borderColor: 'rgba(240, 185, 11, 0.7)',
                  borderWidth: 1,
                  pointRadius: 0,
                  tension: 0.25,
                  fill: false,
                },
                {
                  label: 'MA (long)',
                  data: ticks.map((t) => t.ma_long),
                  borderColor: 'rgba(132, 142, 156, 0.7)',
                  borderWidth: 1,
                  pointRadius: 0,
                  tension: 0.25,
                  fill: false,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              interaction: { mode: 'index', intersect: false },
              scales: {
                x: {
                  ticks: { color: '#848e9c', maxTicksLimit: 6, font: { size: 11 } },
                  grid: { display: false },
                  border: { color: '#2b3139' },
                },
                y: {
                  position: 'right',
                  ticks: {
                    color: '#848e9c',
                    font: { size: 11, family: 'ui-monospace, Consolas, monospace' },
                    callback: (value) => `$${Number(value).toLocaleString()}`,
                  },
                  grid: { color: '#1e2329' },
                  border: { display: false },
                },
              },
              plugins: {
                legend: {
                  display: true,
                  position: 'top',
                  align: 'end',
                  labels: { color: '#848e9c', boxWidth: 10, boxHeight: 10, font: { size: 11 }, usePointStyle: true },
                },
                tooltip: {
                  backgroundColor: '#161a1e',
                  borderColor: '#2b3139',
                  borderWidth: 1,
                  titleColor: '#848e9c',
                  bodyColor: '#eaecef',
                  bodyFont: { family: 'ui-monospace, Consolas, monospace' },
                  padding: 10,
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString()}`,
                  },
                },
              },
            },
          })
        } else {
          const chart = chartRef.current
          chart.data.labels = labels
          chart.data.datasets[0].data = ticks.map((t) => t.price)
          chart.data.datasets[0].borderColor = lineColor
          chart.data.datasets[1].data = ticks.map((t) => t.ma_short)
          chart.data.datasets[2].data = ticks.map((t) => t.ma_long)
          chart.update('none')
        }
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load market data')
      }
    }

    loadTicks()
    const interval = setInterval(loadTicks, 2000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [symbol])

  useEffect(() => {
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [])

  const up = priceChangePct !== null && priceChangePct >= 0

  return (
    <div className="card" style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>{symbol}</h2>
        {currentPrice !== null && (
          <span className="num" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
        {priceChangePct !== null && (
          <span
            className="num"
            style={{ fontSize: '0.9rem', fontWeight: 600, color: up ? 'var(--buy)' : 'var(--sell)' }}
          >
            {up ? '+' : ''}
            {priceChangePct.toFixed(2)}%
          </span>
        )}
      </div>
      {error && <p style={{ color: 'var(--sell)' }}>{error}</p>}
      <div style={{ height: '420px' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
