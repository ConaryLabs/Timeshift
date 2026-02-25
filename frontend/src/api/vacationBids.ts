import { api } from './client'

export type VacationBidPeriodStatus = 'draft' | 'open' | 'in_progress' | 'completed'

export interface VacationBidPeriod {
  id: string
  org_id: string
  year: number
  round: number
  status: VacationBidPeriodStatus
  opens_at: string | null
  closes_at: string | null
  allowance_hours: number | null
  min_block_hours: number | null
  bargaining_unit: string | null
  created_at: string
}

export interface VacationBidWindow {
  id: string
  vacation_bid_period_id: string
  user_id: string
  first_name: string
  last_name: string
  seniority_rank: number
  opens_at: string
  closes_at: string
  submitted_at: string | null
}

export interface VacationBid {
  id: string
  vacation_bid_window_id: string
  start_date: string
  end_date: string
  preference_rank: number
  awarded: boolean
  created_at: string
}

export interface VacationWindowDetail {
  window: VacationBidWindow
  round: number
  year: number
  bids: VacationBid[]
  dates_taken: string[]
  allowance_hours: number | null
  min_block_hours: number | null
  hours_used: number
}

export interface VacationPick {
  start_date: string
  end_date: string
  preference_rank: number
}

export const vacationBidsApi = {
  listPeriods: (year?: number) =>
    api.get<VacationBidPeriod[]>('/api/vacation-bids/periods', { params: year ? { year } : undefined }).then((r) => r.data),

  createPeriod: (body: {
    year: number
    round: number
    allowance_hours?: number | null
    min_block_hours?: number | null
    bargaining_unit?: string | null
  }) =>
    api.post<VacationBidPeriod>('/api/vacation-bids/periods', body).then((r) => r.data),

  deletePeriod: (id: string) =>
    api.delete(`/api/vacation-bids/periods/${id}`).then((r) => r.data),

  openBidding: (id: string, body: { window_duration_hours: number; start_at?: string }) =>
    api.post<VacationBidPeriod>(`/api/vacation-bids/periods/${id}/open-bidding`, body).then((r) => r.data),

  listWindows: (periodId: string) =>
    api.get<VacationBidWindow[]>(`/api/vacation-bids/periods/${periodId}/bid-windows`).then((r) => r.data),

  getWindow: (windowId: string) =>
    api.get<VacationWindowDetail>(`/api/vacation-bids/bid-windows/${windowId}`).then((r) => r.data),

  submitBid: (windowId: string, body: { picks: VacationPick[] }) =>
    api.post<VacationBid[]>(`/api/vacation-bids/bid-windows/${windowId}/submit`, body).then((r) => r.data),

  processBids: (periodId: string) =>
    api.post<VacationBidPeriod>(`/api/vacation-bids/periods/${periodId}/process-bids`).then((r) => r.data),
}
