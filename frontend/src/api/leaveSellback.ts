import { apiClient } from './client'

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
    apiClient.get<HolidaySellbackRequest[]>('/api/leave/sellback'),

  create: (body: { fiscal_year: number; period: string; hours_requested: number }) =>
    apiClient.post<HolidaySellbackRequest>('/api/leave/sellback', body),

  review: (id: string, body: { status: string; reviewer_notes?: string }) =>
    apiClient.patch<HolidaySellbackRequest>(`/api/leave/sellback/${id}/review`, body),

  cancel: (id: string) =>
    apiClient.patch(`/api/leave/sellback/${id}/cancel`),
}
