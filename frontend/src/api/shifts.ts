import { apiClient } from './client'

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
    apiClient.get<ScheduledShift[]>('/api/shifts/scheduled', { params }),

  getScheduled: (id: string) =>
    apiClient.get<ScheduledShift>(`/api/shifts/scheduled/${id}`),

  createScheduled: (body: {
    shift_template_id: string
    date: string
    required_headcount?: number
    slot_id?: string
    notes?: string
  }) => apiClient.post<ScheduledShift>('/api/shifts/scheduled', body),

  deleteScheduled: (id: string) =>
    apiClient.delete(`/api/shifts/scheduled/${id}`),
}
