// frontend/src/api/teams.ts
import { apiClient } from './client'

export interface TeamSummary {
  id: string
  name: string
  supervisor_id: string | null
  supervisor_name: string | null
  parent_team_id: string | null
  parent_team_name: string | null
  is_active: boolean
  slot_count: number
  member_count: number
  /** Present when backend returns it; used for optimistic locking. */
  updated_at?: string
}

export interface TeamMember {
  user_id: string
  first_name: string
  last_name: string
  classification_abbreviation: string | null
  role: string
  shift_name: string | null
}

export interface Team {
  id: string
  org_id: string
  name: string
  supervisor_id: string | null
  parent_team_id: string | null
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
    apiClient.get<TeamSummary[]>('/api/teams'),

  get: (id: string) =>
    apiClient.get<Team>(`/api/teams/${id}`),

  create: (body: { name: string; supervisor_id?: string; parent_team_id?: string }) =>
    apiClient.post<Team>('/api/teams', body),

  update: (id: string, body: { name?: string; supervisor_id?: string | null; parent_team_id?: string | null; is_active?: boolean; expected_updated_at?: string }) =>
    apiClient.patch<Team>(`/api/teams/${id}`, body),

  listSlots: (teamId: string) =>
    apiClient.get<ShiftSlotView[]>(`/api/teams/${teamId}/slots`),

  createSlot: (teamId: string, body: {
    shift_template_id: string
    classification_id: string
    days_of_week: number[]
    label?: string
  }) => apiClient.post<ShiftSlotView>(`/api/teams/${teamId}/slots`, body),

  updateSlot: (slotId: string, body: {
    shift_template_id?: string
    classification_id?: string
    days_of_week?: number[]
    label?: string
    is_active?: boolean
  }) => apiClient.patch<ShiftSlotView>(`/api/shift-slots/${slotId}`, body),

  listMembers: (teamId: string) =>
    apiClient.get<TeamMember[]>(`/api/teams/${teamId}/members`),
}
