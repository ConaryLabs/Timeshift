import { api } from './client'

export interface ScheduledShift {
  id: string
  org_id: string
  shift_template_id: string
  date: string
  required_headcount: number
  slot_id: string | null
  notes: string | null
  created_at: string
}

export const shiftsApi = {
  listScheduled: (params?: { start_date?: string; end_date?: string }) =>
    api.get<ScheduledShift[]>('/api/shifts/scheduled', { params }).then((r) => r.data),

  getScheduled: (id: string) =>
    api.get<ScheduledShift>(`/api/shifts/scheduled/${id}`).then((r) => r.data),

  createScheduled: (body: {
    shift_template_id: string
    date: string
    required_headcount?: number
    slot_id?: string
    notes?: string
  }) => api.post<ScheduledShift>('/api/shifts/scheduled', body).then((r) => r.data),

  deleteScheduled: (id: string) =>
    api.delete(`/api/shifts/scheduled/${id}`).then((r) => r.data),
}
