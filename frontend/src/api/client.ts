import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '../store/auth'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** Sentinel error rejected on session expiry — global onError skips toast for these */
export const SESSION_EXPIRED = Symbol('SESSION_EXPIRED')

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const token = useAuthStore.getState().token
      if (token) {
        // Session expired: toast here, reject with sentinel so global
        // mutation onError skips the duplicate toast
        toast.error('Session expired — please log in again')
        useAuthStore.getState().logout()
        return Promise.reject(SESSION_EXPIRED)
      }
      // Login failure (no token): reject normally so page-level catch works
    }
    return Promise.reject(err)
  },
)
