import { apiClient } from './client'
import type { CalloutListEntry } from './callout'
import type { CalloutStep } from './ot'

export interface CalloutEventSummary {
  id: string
  status: 'open' | 'filled' | 'cancelled'
  current_step: CalloutStep | null
}

export interface OtRequestSummary {
  id: string
  status: string
  volunteer_count: number
  assignment_count: number
  start_time: string
  end_time: string
}

export interface StaffingAvailableResponse {
  employees: CalloutListEntry[]
  scheduled_shift_id: string
  shift_template_name: string
  shift_start_time: string
  shift_end_time: string
  shift_duration_minutes: number
  existing_callout: CalloutEventSummary | null
  existing_ot_requests: OtRequestSummary[]
}

export interface MandatoryOtOrderEntry {
  user_id: string
  last_mandatory_at: string | null
}

export const staffingApi = {
  getAvailable: (params: { date: string; shift_template_id: string; classification_id?: string }) =>
    apiClient.get<StaffingAvailableResponse>('/api/staffing/available', { params }),

  blockAvailable: (params: { date: string; classification_id: string; block_start: string; block_end: string }) =>
    apiClient.get<StaffingAvailableResponse>('/api/staffing/block-available', { params }),

  mandatoryOtOrder: (params: { classification_id: string }) =>
    apiClient.get<MandatoryOtOrderEntry[]>('/api/staffing/mandatory-ot-order', { params }),
}
