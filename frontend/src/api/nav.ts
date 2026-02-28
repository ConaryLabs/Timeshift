import { apiClient } from './client'

export interface NavBadges {
  pending_leave: number
  pending_trades: number
  open_callouts: number
}

export const navApi = {
  badges: () => apiClient.get<NavBadges>('/api/nav/badges'),
}
