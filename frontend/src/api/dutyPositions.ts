import { api } from './client'

export interface DutyPosition {
  id: string
  org_id: string
  name: string
  classification_id: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DutyAssignment {
  id: string
  org_id: string
  duty_position_id: string
  duty_position_name: string
  user_id: string
  user_first_name: string
  user_last_name: string
  date: string
  shift_template_id: string | null
  shift_template_name: string | null
  notes: string | null
  assigned_by: string | null
  created_at: string
  updated_at: string
}

export const dutyPositionsApi = {
  list: () =>
    api.get<DutyPosition[]>('/api/duty-positions').then((r) => r.data),

  create: (body: { name: string; classification_id?: string; sort_order?: number }) =>
    api.post<DutyPosition>('/api/duty-positions', body).then((r) => r.data),

  update: (id: string, body: { name?: string; classification_id?: string | null; sort_order?: number; is_active?: boolean }) =>
    api.patch<DutyPosition>(`/api/duty-positions/${id}`, body).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/duty-positions/${id}`).then((r) => r.data),

  listAssignments: (params: { date: string; shift_template_id?: string }) =>
    api.get<DutyAssignment[]>('/api/duty-assignments', { params }).then((r) => r.data),

  createAssignment: (body: {
    duty_position_id: string
    user_id: string
    date: string
    shift_template_id?: string
    notes?: string
  }) => api.post<DutyAssignment>('/api/duty-assignments', body).then((r) => r.data),

  updateAssignment: (id: string, body: { user_id?: string; notes?: string | null }) =>
    api.patch<DutyAssignment>(`/api/duty-assignments/${id}`, body).then((r) => r.data),

  deleteAssignment: (id: string) =>
    api.delete(`/api/duty-assignments/${id}`).then((r) => r.data),
}
