import { apiClient } from './client'

export interface ShiftPattern {
  id: string
  org_id: string
  name: string
  pattern_days: number
  work_days: number
  off_days: number
  anchor_date: string
  team_id: string | null
  is_active: boolean
  work_days_in_cycle: number[] | null
  created_at: string
  updated_at: string
}

export interface CycleInfo {
  pattern_id: string
  pattern_name: string
  date: string
  cycle_day: number
  is_work_day: boolean
  pattern_days: number
  work_days: number
  off_days: number
  work_days_in_cycle: number[] | null
}

export interface ShiftPatternAssignment {
  id: string
  user_id: string
  user_name: string
  pattern_id: string
  pattern_name: string
  effective_from: string
  effective_to: string | null
}

export const shiftPatternsApi = {
  list: () =>
    apiClient.get<ShiftPattern[]>('/api/shift-patterns'),

  create: (data: {
    name: string
    pattern_days: number
    work_days?: number
    off_days?: number
    anchor_date: string
    team_id?: string | null
    work_days_in_cycle?: number[] | null
  }) =>
    apiClient.post<ShiftPattern>('/api/shift-patterns', data),

  update: (id: string, data: {
    name?: string
    pattern_days?: number
    work_days?: number
    off_days?: number
    anchor_date?: string
    team_id?: string | null
    is_active?: boolean
    work_days_in_cycle?: number[] | null
  }) =>
    apiClient.patch<ShiftPattern>(`/api/shift-patterns/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/api/shift-patterns/${id}`),

  cycle: (id: string, date: string) =>
    apiClient.get<CycleInfo>(`/api/shift-patterns/${id}/cycle`, { params: { date } }),

  // Assignments
  listAssignments: () =>
    apiClient.get<ShiftPatternAssignment[]>('/api/shift-pattern-assignments'),

  createAssignment: (data: {
    user_id: string
    pattern_id: string
    effective_from: string
    effective_to?: string | null
  }) =>
    apiClient.post<ShiftPatternAssignment>('/api/shift-pattern-assignments', data),

  deleteAssignment: (id: string) =>
    apiClient.delete(`/api/shift-pattern-assignments/${id}`),
}
