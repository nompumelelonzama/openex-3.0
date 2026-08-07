import { create } from 'zustand'

interface AuthState {
  token: string | null
  setToken: (token: string | null) => void
  logout: () => void
}

const STORAGE_KEY = 'openex_token'

export const useAuthStore = create<AuthState>((set) => ({
  token: sessionStorage.getItem(STORAGE_KEY),
  setToken: (token) => {
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, token)
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
    set({ token })
  },
  logout: () => {
    sessionStorage.removeItem(STORAGE_KEY)
    set({ token: null })
  },
}))