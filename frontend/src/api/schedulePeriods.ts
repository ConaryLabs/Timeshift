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

export const schedulePeriodsApi = {
  list: () =>
    api.get<SchedulePeriod[]>('/api/schedule/periods').then((r) => r.data),

  create: (body: { name: string; start_date: string; end_date: string }) =>
    api.post<SchedulePeriod>('/api/schedule/periods', body).then((r) => r.data),

  assignSlot: (periodId: string, body: { slot_id: string; user_id: string }) =>
    api.post<SlotAssignment>(`/api/schedule/periods/${periodId}/assign`, body).then((r) => r.data),
}
