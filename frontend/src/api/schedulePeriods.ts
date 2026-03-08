// frontend/src/api/schedulePeriods.ts
import { apiClient } from './client'

import type { BidPeriodStatus } from './bidding'

export interface SchedulePeriod {
  id: string
  org_id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  status: BidPeriodStatus
  bid_opens_at: string | null
  bid_closes_at: string | null
  bargaining_unit: string | null
  created_at: string
}

export interface SlotAssignment {
  id: string
  slot_id: string
  user_id: string
  period_id: string
  created_at: string
  updated_at: string
}

export interface SlotAssignmentView {
  slot_id: string
  team_id: string
  team_name: string
  shift_template_name: string
  start_time: string
  end_time: string
  classification_id: string
  classification_name: string
  classification_abbreviation: string
  days_of_week: number[]
  label: string | null
  slot_is_active: boolean
  assignment_id: string | null
  user_id: string | null
  user_first_name: string | null
  user_last_name: string | null
}

export const schedulePeriodsApi = {
  list: () =>
    apiClient.get<SchedulePeriod[]>('/api/schedule/periods'),

  create: (body: { name: string; start_date: string; end_date: string; bargaining_unit?: string | null }) =>
    apiClient.post<SchedulePeriod>('/api/schedule/periods', body),

  update: (id: string, body: { name?: string; start_date?: string; end_date?: string; bargaining_unit?: string | null }) =>
    apiClient.patch<SchedulePeriod>(`/api/schedule/periods/${id}`, body),

  assignSlot: (periodId: string, body: { slot_id: string; user_id: string }) =>
    apiClient.post<SlotAssignment>(`/api/schedule/periods/${periodId}/assign`, body),

  listAssignments: (periodId: string) =>
    apiClient.get<SlotAssignmentView[]>(`/api/schedule/periods/${periodId}/assignments`),

  removeAssignment: (periodId: string, slotId: string) =>
    apiClient.delete(`/api/schedule/periods/${periodId}/assignments/${slotId}`),
}
