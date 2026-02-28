import { api } from './client'

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
    api.get<Classification[]>('/api/classifications', { params }).then((r) => r.data),

  create: (body: { name: string; abbreviation: string; display_order?: number }) =>
    api.post<Classification>('/api/classifications', body).then((r) => r.data),

  update: (id: string, body: { name?: string; abbreviation?: string; display_order?: number; is_active?: boolean }) =>
    api.patch<Classification>(`/api/classifications/${id}`, body).then((r) => r.data),
}
