import { api } from './client'

export interface SchedulePeriod {
  id: string
  org_id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
}

export interface SlotAssignment {
  id: string
  slot_id: string
  user_id: string
  period_id: string
  created_at: string
}

export interface SlotAssignmentView {
  slot_id: string
  team_id: string
  team_name: string
  shift_template_name: string
  start_time: string
  end_time: string
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
    api.get<SchedulePeriod[]>('/api/schedule/periods').then((r) => r.data),

  create: (body: { name: string; start_date: string; end_date: string }) =>
    api.post<SchedulePeriod>('/api/schedule/periods', body).then((r) => r.data),

  assignSlot: (periodId: string, body: { slot_id: string; user_id: string }) =>
    api.post<SlotAssignment>(`/api/schedule/periods/${periodId}/assign`, body).then((r) => r.data),

  listAssignments: (periodId: string) =>
    api.get<SlotAssignmentView[]>(`/api/schedule/periods/${periodId}/assignments`).then((r) => r.data),

  removeAssignment: (periodId: string, slotId: string) =>
    api.delete(`/api/schedule/periods/${periodId}/assignments/${slotId}`).then((r) => r.data),
}
