const ANALYTICS_API_BASE = import.meta.env.VITE_ANALYTICS_API_BASE || 'http://localhost:5000'

export function getAuthHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function analyticsFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${ANALYTICS_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Analytics API ${path} failed: ${res.status} ${text}`)
  }
  return res.json().catch(() => null)
}
