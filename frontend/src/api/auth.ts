import { apiClient } from './client'
import type { UserProfile } from '../store/auth'

export const authApi = {
  me: () => apiClient.get<UserProfile>('/api/auth/me'),
  logout: () => apiClient.post('/api/auth/logout'),
}
