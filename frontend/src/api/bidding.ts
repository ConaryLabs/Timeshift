import { api } from './client'

export type BidPeriodStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'archived'

export interface BidWindow {
  id: string
  period_id: string
  user_id: string
  first_name: string
  last_name: string
  seniority_rank: number
  opens_at: string
  closes_at: string
  submitted_at: string | null
  unlocked_at: string | null
  approved_at: string | null
  approved_by: string | null
  is_job_share: boolean
}

export interface AvailableSlot {
  slot_id: string
  team_name: string
  shift_template_name: string
  start_time: string
  end_time: string
  classification_name: string
  classification_abbreviation: string
  days_of_week: number[]
  label: string | null
  already_awarded: boolean
  is_flex: boolean
}

export interface BidSubmissionView {
  id: string
  slot_id: string
  shift_template_name: string
  team_name: string
  classification_name: string
  days_of_week: number[]
  preference_rank: number
  awarded: boolean
}

export interface BidWindowDetail {
  window: BidWindow
  available_slots: AvailableSlot[]
  submissions: BidSubmissionView[]
}

export interface BidPreference {
  slot_id: string
  preference_rank: number
}

export const biddingApi = {
  openBidding: (periodId: string, body: { window_duration_hours: number; start_at?: string }) =>
    api.post<BidWindow[]>(`/api/schedule/periods/${periodId}/open-bidding`, body).then((r) => r.data),

  listBidWindows: (periodId: string) =>
    api.get<BidWindow[]>(`/api/schedule/periods/${periodId}/bid-windows`).then((r) => r.data),

  getBidWindow: (windowId: string) =>
    api.get<BidWindowDetail>(`/api/bid-windows/${windowId}`).then((r) => r.data),

  submitBid: (windowId: string, body: { preferences: BidPreference[] }) =>
    api.post(`/api/bid-windows/${windowId}/submit`, body).then((r) => r.data),

  processBids: (periodId: string) =>
    api.post(`/api/schedule/periods/${periodId}/process-bids`).then((r) => r.data),

  approveBidWindow: (windowId: string) =>
    api.post(`/api/bid-windows/${windowId}/approve`).then((r) => r.data),
}
