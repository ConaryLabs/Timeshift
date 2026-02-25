import { api } from './client'

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
}

export const shiftPatternsApi = {
  list: () =>
    api.get<ShiftPattern[]>('/api/shift-patterns').then((r) => r.data),

  create: (data: {
    name: string
    pattern_days: number
    work_days: number
    off_days: number
    anchor_date: string
    team_id?: string | null
  }) =>
    api.post<ShiftPattern>('/api/shift-patterns', data).then((r) => r.data),

  update: (id: string, data: {
    name?: string
    pattern_days?: number
    work_days?: number
    off_days?: number
    anchor_date?: string
    team_id?: string | null
    is_active?: boolean
  }) =>
    api.patch<ShiftPattern>(`/api/shift-patterns/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/shift-patterns/${id}`).then((r) => r.data),

  cycle: (id: string, date: string) =>
    api.get<CycleInfo>(`/api/shift-patterns/${id}/cycle`, { params: { date } }).then((r) => r.data),
}
