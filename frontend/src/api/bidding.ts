import { apiClient } from './client'

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
  auto_advanced_at: string | null
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
    apiClient.post<BidWindow[]>(`/api/schedule/periods/${periodId}/open-bidding`, body),

  listBidWindows: (periodId: string) =>
    apiClient.get<BidWindow[]>(`/api/schedule/periods/${periodId}/bid-windows`),

  getBidWindow: (windowId: string) =>
    apiClient.get<BidWindowDetail>(`/api/bid-windows/${windowId}`),

  submitBid: (windowId: string, body: { preferences: BidPreference[] }) =>
    apiClient.post(`/api/bid-windows/${windowId}/submit`, body),

  processBids: (periodId: string) =>
    apiClient.post<{ awards_count: number; total_bidders: number }>(`/api/schedule/periods/${periodId}/process-bids`),

  approveBidWindow: (windowId: string) =>
    apiClient.post(`/api/bid-windows/${windowId}/approve`),
}
