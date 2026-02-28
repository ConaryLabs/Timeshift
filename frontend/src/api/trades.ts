import { apiClient } from './client'

export type TradeStatus = 'pending_partner' | 'pending_approval' | 'approved' | 'denied' | 'cancelled'

export interface TradeRequest {
  id: string
  org_id: string
  requester_id: string
  requester_name: string
  partner_id: string
  partner_name: string
  requester_assignment_id: string
  partner_assignment_id: string
  requester_date: string
  partner_date: string
  status: TradeStatus
  reviewed_by: string | null
  reviewer_notes: string | null
  created_at: string
  updated_at: string
}

export interface TradeListParams {
  status?: TradeStatus
  user_id?: string
  limit?: number
  offset?: number
}

export const tradesApi = {
  list: (params?: TradeListParams) =>
    apiClient.get<TradeRequest[]>('/api/trades', { params }),

  get: (id: string) =>
    apiClient.get<TradeRequest>(`/api/trades/${id}`),

  create: (body: {
    partner_id: string
    requester_assignment_id: string
    partner_assignment_id: string
  }) => apiClient.post<TradeRequest>('/api/trades', body),

  respond: (id: string, body: { accept: boolean }) =>
    apiClient.patch<TradeRequest>(`/api/trades/${id}/respond`, body),

  review: (id: string, body: { status: 'approved' | 'denied'; reviewer_notes?: string }) =>
    apiClient.patch<TradeRequest>(`/api/trades/${id}/review`, body),

  cancel: (id: string) =>
    apiClient.patch(`/api/trades/${id}/cancel`),

  bulkReview: (body: { ids: string[]; status: 'approved' | 'denied'; reviewer_notes?: string }) =>
    apiClient.post<{ ok: boolean; reviewed: number }>('/api/trades/bulk-review', body),
}
