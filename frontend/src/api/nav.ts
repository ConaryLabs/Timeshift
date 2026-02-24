import { api } from './client'

export interface NavBadges {
  pending_leave: number
  pending_trades: number
  open_callouts: number
}

export const navApi = {
  badges: () => api.get<NavBadges>('/api/nav/badges').then((r) => r.data),
}
