// frontend/src/api/holidays.ts
import { apiClient } from './client'

export interface Holiday {
  id: string
  org_id: string
  date: string
  name: string
  is_premium_pay: boolean
  created_at: string
}

export const holidaysApi = {
  list: (year?: number) =>
    apiClient.get<Holiday[]>('/api/holidays', { params: year ? { year } : undefined }),

  create: (body: { date: string; name: string; is_premium_pay?: boolean }) =>
    apiClient.post<Holiday>('/api/holidays', body),

  update: (id: string, body: { name?: string; is_premium_pay?: boolean }) =>
    apiClient.patch<Holiday>(`/api/holidays/${id}`, body),

  delete: (id: string) =>
    apiClient.delete(`/api/holidays/${id}`),
}
