import { useAuthStore } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export function getAuthHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (res.status === 401 || res.status === 403) {
    // Session invalid or expired: clear it and send the user back to login
    // rather than surfacing a raw API error in the UI.
    useAuthStore.getState().logout()
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Session expired. Please log in again.')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${path} failed: ${res.status} ${text}`)
  }
  return res.json().catch(() => null)
}
