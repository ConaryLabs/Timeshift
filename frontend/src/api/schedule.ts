import { api } from './client'

export interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  crosses_midnight: boolean
  duration_minutes: number
  color: string
  is_active: boolean
}

export interface AssignmentView {
  assignment_id: string
  date: string
  shift_name: string
  shift_color: string
  start_time: string
  end_time: string
  crosses_midnight: boolean
  user_id: string
  employee_id: string
  first_name: string
  last_name: string
  position: string
  is_overtime: boolean
  notes: string | null
}

export const scheduleApi = {
  getTemplates: () =>
    api.get<ShiftTemplate[]>('/api/shifts/templates').then((r) => r.data),

  createTemplate: (body: {
    name: string
    start_time: string
    end_time: string
    color?: string
  }) => api.post<ShiftTemplate>('/api/shifts/templates', body).then((r) => r.data),

  getStaffing: (start_date: string, end_date: string) =>
    api
      .get<AssignmentView[]>('/api/schedule', { params: { start_date, end_date } })
      .then((r) => r.data),

  createAssignment: (body: {
    scheduled_shift_id: string
    user_id: string
    position: string
    is_overtime: boolean
    notes?: string
  }) => api.post('/api/schedule/assignments', body).then((r) => r.data),

  deleteAssignment: (id: string) =>
    api.delete(`/api/schedule/assignments/${id}`).then((r) => r.data),
}
