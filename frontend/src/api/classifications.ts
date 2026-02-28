import { apiClient } from './client'

export interface Classification {
  id: string
  org_id: string
  name: string
  abbreviation: string
  display_order: number
  is_active: boolean
  created_at: string
}

export const classificationsApi = {
  list: (params?: { include_inactive?: boolean }) =>
    apiClient.get<Classification[]>('/api/classifications', { params }),

  create: (body: { name: string; abbreviation: string; display_order?: number }) =>
    apiClient.post<Classification>('/api/classifications', body),

  update: (id: string, body: { name?: string; abbreviation?: string; display_order?: number; is_active?: boolean }) =>
    apiClient.patch<Classification>(`/api/classifications/${id}`, body),
}
