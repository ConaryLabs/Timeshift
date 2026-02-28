import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '../store/auth'

import { SESSION_EXPIRED } from './constants'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

// Re-export so existing consumers (e.g. main.tsx) don't need to change their imports
export { SESSION_EXPIRED }

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// ---------------------------------------------------------------------------
// Multi-tab refresh coordination via BroadcastChannel
// ---------------------------------------------------------------------------
type RefreshMessage =
  | { type: 'refresh-start' }
  | { type: 'refresh-success' }
  | { type: 'refresh-failure' }
  | { type: 'logout' }

const refreshChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('timeshift-auth-refresh')
    : null

/** True when *this* tab is performing the refresh */
let refreshing = false
/** True when *another* tab told us it is refreshing */
let remoteRefreshing = false
const refreshQueue: Array<(ok: boolean) => void> = []

/** Resolve all queued requests when a remote tab finishes refreshing */
function drainQueue(ok: boolean) {
  refreshQueue.forEach((cb) => cb(ok))
  refreshQueue.length = 0
}

/** Full logout: clear auth + query cache + UI selections. Used on session expiry. */
function performLogout() {
  // auth store's logout() also clears queryClient and resets UI store
  useAuthStore.getState().logout()
}

if (refreshChannel) {
  refreshChannel.onmessage = (event: MessageEvent<RefreshMessage>) => {
    const msg = event.data
    switch (msg.type) {
      case 'refresh-start':
        remoteRefreshing = true
        break
      case 'refresh-success':
        remoteRefreshing = false
        drainQueue(true)
        break
      case 'refresh-failure':
        remoteRefreshing = false
        toast.error('Session expired — please log in again')
        performLogout()
        drainQueue(false)
        break
      case 'logout':
        // Another tab logged out explicitly — follow suit
        performLogout()
        drainQueue(false)
        break
    }
  }
}

/** Broadcast a refresh message to other tabs (no-op if BroadcastChannel unavailable) */
function broadcast(msg: RefreshMessage) {
  try { refreshChannel?.postMessage(msg) } catch { /* channel closed */ }
}

// Silent-refresh on 401 + queue pattern (with multi-tab coordination)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config
    if (err.response?.status === 401 && !config._retry && config.url !== '/api/auth/refresh' && useAuthStore.getState().user) {
      // If this tab or another tab is already refreshing, queue and wait
      if (refreshing || remoteRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((ok) => (ok ? resolve(api(config)) : reject(SESSION_EXPIRED)))
        })
      }
      config._retry = true
      refreshing = true
      broadcast({ type: 'refresh-start' })
      try {
        await api.post('/api/auth/refresh')
        broadcast({ type: 'refresh-success' })
        drainQueue(true)
        return await api(config)
      } catch {
        toast.error('Session expired — please log in again')
        broadcast({ type: 'refresh-failure' })
        performLogout()
        drainQueue(false)
        return Promise.reject(SESSION_EXPIRED)
      } finally {
        refreshing = false
      }
    }
    // Login failure (no session) or non-retryable 401: reject normally
    return Promise.reject(err)
  },
)

/** Broadcast logout to other tabs. Call this from explicit user-initiated logout. */
export function broadcastLogout() {
  broadcast({ type: 'logout' })
}
