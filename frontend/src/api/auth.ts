import { api } from './client'
import type { UserProfile } from '../store/auth'

export const authApi = {
  me: () => api.get<UserProfile>('/api/auth/me').then((r) => r.data),
}
