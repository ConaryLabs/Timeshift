// frontend/src/api/dutyPositions.ts
import { apiClient } from './client'

export interface DutyPosition {
  id: string
  org_id: string
  name: string
  classification_id: string | null
  sort_order: number
  is_active: boolean
  board_date: string | null
  created_at: string
  updated_at: string
}

export interface DutyAssignment {
  id: string
  org_id: string
  duty_position_id: string
  duty_position_name: string
  user_id: string | null
  user_first_name: string | null
  user_last_name: string | null
  date: string
  block_index: number
  status: string
  notes: string | null
  assigned_by: string | null
  created_at: string
  updated_at: string
}

export const dutyPositionsApi = {
  list: () =>
    apiClient.get<DutyPosition[]>('/api/duty-positions'),

  create: (body: { name: string; classification_id?: string; sort_order?: number; board_date?: string }) =>
    apiClient.post<DutyPosition>('/api/duty-positions', body),

  update: (id: string, body: { name?: string; classification_id?: string | null; sort_order?: number; is_active?: boolean }) =>
    apiClient.patch<DutyPosition>(`/api/duty-positions/${id}`, body),

  delete: (id: string) =>
    apiClient.delete(`/api/duty-positions/${id}`),

  listAssignments: (params: { date: string }) =>
    apiClient.get<DutyAssignment[]>('/api/duty-assignments', { params }),

  createAssignment: (body: {
    duty_position_id: string
    user_id: string
    date: string
    block_index: number
    notes?: string
  }) => apiClient.post<DutyAssignment>('/api/duty-assignments', body),

  updateAssignment: (id: string, body: { user_id?: string; notes?: string | null }) =>
    apiClient.patch<DutyAssignment>(`/api/duty-assignments/${id}`, body),

  deleteAssignment: (id: string) =>
    apiClient.delete(`/api/duty-assignments/${id}`),
}
