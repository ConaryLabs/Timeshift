import { api } from './client'

export interface TeamSummary {
  id: string
  name: string
  supervisor_id: string | null
  supervisor_name: string | null
  is_active: boolean
  slot_count: number
}

export interface Team {
  id: string
  org_id: string
  name: string
  supervisor_id: string | null
  is_active: boolean
  created_at: string
  slots: ShiftSlotView[]
}

export interface ShiftSlotView {
  id: string
  team_id: string
  shift_template_id: string
  shift_template_name: string
  start_time: string
  end_time: string
  classification_id: string
  classification_abbreviation: string
  days_of_week: number[]
  label: string | null
  is_active: boolean
}

export const teamsApi = {
  list: () =>
    api.get<TeamSummary[]>('/api/teams').then((r) => r.data),

  get: (id: string) =>
    api.get<Team>(`/api/teams/${id}`).then((r) => r.data),

  create: (body: { name: string; supervisor_id?: string }) =>
    api.post<Team>('/api/teams', body).then((r) => r.data),

  update: (id: string, body: { name?: string; supervisor_id?: string | null; is_active?: boolean }) =>
    api.put<Team>(`/api/teams/${id}`, body).then((r) => r.data),

  listSlots: (teamId: string) =>
    api.get<ShiftSlotView[]>(`/api/teams/${teamId}/slots`).then((r) => r.data),

  createSlot: (teamId: string, body: {
    shift_template_id: string
    classification_id: string
    days_of_week: number[]
    label?: string
  }) => api.post<ShiftSlotView>(`/api/teams/${teamId}/slots`, body).then((r) => r.data),

  updateSlot: (slotId: string, body: {
    shift_template_id?: string
    classification_id?: string
    days_of_week?: number[]
    label?: string
    is_active?: boolean
  }) => api.put<ShiftSlotView>(`/api/shift-slots/${slotId}`, body).then((r) => r.data),
}
