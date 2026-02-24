import { api } from './client'

export interface HolidaySellbackRequest {
  id: string
  org_id: string
  user_id: string
  fiscal_year: number
  period: string
  hours_requested: number
  status: string
  reviewed_by: string | null
  reviewer_notes: string | null
  created_at: string
  updated_at: string
}

export const leaveSellbackApi = {
  list: () =>
    api.get<HolidaySellbackRequest[]>('/api/leave/sellback').then((r) => r.data),

  create: (body: { fiscal_year: number; period: string; hours_requested: number }) =>
    api.post<HolidaySellbackRequest>('/api/leave/sellback', body).then((r) => r.data),

  review: (id: string, body: { status: string; reviewer_notes?: string }) =>
    api.patch<HolidaySellbackRequest>(`/api/leave/sellback/${id}/review`, body).then((r) => r.data),

  cancel: (id: string) =>
    api.patch(`/api/leave/sellback/${id}/cancel`).then((r) => r.data),
}
