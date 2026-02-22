import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '../store/auth'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** Sentinel error rejected on session expiry — global onError skips toast for these */
export const SESSION_EXPIRED = Symbol('SESSION_EXPIRED')

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

let refreshing = false
const refreshQueue: Array<(ok: boolean) => void> = []

// Silent-refresh on 401 + queue pattern
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config
    if (err.response?.status === 401 && !config._retry && useAuthStore.getState().user) {
      if (refreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((ok) => (ok ? resolve(api(config)) : reject(SESSION_EXPIRED)))
        })
      }
      config._retry = true
      refreshing = true
      try {
        await api.post('/api/auth/refresh')
        refreshQueue.forEach((cb) => cb(true))
        refreshQueue.length = 0
        return api(config)
      } catch {
        toast.error('Session expired — please log in again')
        useAuthStore.getState().logout()
        refreshQueue.forEach((cb) => cb(false))
        refreshQueue.length = 0
        return Promise.reject(SESSION_EXPIRED)
      } finally {
        refreshing = false
      }
    }
    // Login failure (no session) or non-retryable 401: reject normally
    return Promise.reject(err)
  },
)
