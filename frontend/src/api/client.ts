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

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const user = useAuthStore.getState().user
      if (user) {
        // Session expired: toast here, reject with sentinel so global
        // mutation onError skips the duplicate toast
        toast.error('Session expired — please log in again')
        useAuthStore.getState().logout()
        return Promise.reject(SESSION_EXPIRED)
      }
      // Login failure (no session): reject normally so page-level catch works
    }
    return Promise.reject(err)
  },
)
