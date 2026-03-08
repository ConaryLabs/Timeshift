// frontend/src/api/auth.ts
import { apiClient } from './client'
import type { UserProfile } from '../store/auth'

export interface LoginResponse {
  user: UserProfile
}

export const authApi = {
  login: (body: { email: string; password: string; org_slug?: string }) =>
    apiClient.post<LoginResponse>('/api/auth/login', body),
  me: () => apiClient.get<UserProfile>('/api/auth/me'),
  logout: () => apiClient.post('/api/auth/logout'),
}
