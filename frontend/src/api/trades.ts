import { api } from './client'

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
    api.get<TradeRequest[]>('/api/trades', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<TradeRequest>(`/api/trades/${id}`).then((r) => r.data),

  create: (body: {
    partner_id: string
    requester_assignment_id: string
    partner_assignment_id: string
  }) => api.post<TradeRequest>('/api/trades', body).then((r) => r.data),

  respond: (id: string, body: { accept: boolean }) =>
    api.patch<TradeRequest>(`/api/trades/${id}/respond`, body).then((r) => r.data),

  review: (id: string, body: { approve: boolean; reviewer_notes?: string }) =>
    api.patch<TradeRequest>(`/api/trades/${id}/review`, body).then((r) => r.data),

  cancel: (id: string) =>
    api.delete(`/api/trades/${id}`).then((r) => r.data),

  bulkReview: (body: { ids: string[]; approve: boolean; reviewer_notes?: string }) =>
    api.post<{ ok: boolean; reviewed: number }>('/api/trades/bulk-review', body).then((r) => r.data),
}
