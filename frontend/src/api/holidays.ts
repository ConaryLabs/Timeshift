import { api } from './client'

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
    api.get<Holiday[]>('/api/holidays', { params: year ? { year } : undefined }).then((r) => r.data),

  create: (body: { date: string; name: string; is_premium_pay?: boolean }) =>
    api.post<Holiday>('/api/holidays', body).then((r) => r.data),

  update: (id: string, body: { name?: string; is_premium_pay?: boolean }) =>
    api.patch<Holiday>(`/api/holidays/${id}`, body).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/holidays/${id}`).then((r) => r.data),
}
