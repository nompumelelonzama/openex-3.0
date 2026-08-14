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

  useEffect(() => {
    let cancelled = false

    async function loadTicks() {
      try {
        const data = await analyticsFetch(`/api/market/ticks?symbol=${symbol}&limit=60`)
        if (cancelled || !canvasRef.current) return

        const ticks: Tick[] = data.ticks
        const labels = ticks.map((t) =>
          new Date(t.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
        )

        if (!chartRef.current) {
          chartRef.current = new Chart(canvasRef.current, {
            type: 'line',
            data: {
              labels,
              datasets: [
                {
                  label: 'Price',
                  data: ticks.map((t) => t.price),
                  borderColor: '#e5e5e5',
                  borderWidth: 1.5,
                  pointRadius: 0,
                  tension: 0.15,
                },
                {
                  label: `MA (short)`,
                  data: ticks.map((t) => t.ma_short),
                  borderColor: 'lightgreen',
                  borderWidth: 1.5,
                  pointRadius: 0,
                  tension: 0.15,
                },
                {
                  label: `MA (long)`,
                  data: ticks.map((t) => t.ma_long),
                  borderColor: 'salmon',
                  borderWidth: 1.5,
                  pointRadius: 0,
                  tension: 0.15,
                },
              ],
            },
            options: {
              responsive: true,
              animation: false,
              scales: {
                x: { ticks: { color: '#888', maxTicksLimit: 8 }, grid: { color: '#222' } },
                y: { ticks: { color: '#888' }, grid: { color: '#222' } },
              },
              plugins: {
                legend: { labels: { color: '#ccc' } },
              },
            },
          })
        } else {
          const chart = chartRef.current
          chart.data.labels = labels
          chart.data.datasets[0].data = ticks.map((t) => t.price)
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

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>{symbol} Price</h2>
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <div style={{ maxWidth: '700px' }}>
        <canvas ref={canvasRef} height={220} />
      </div>
    </div>
  )
}