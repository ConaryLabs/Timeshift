// frontend/src/api/dutyBoard.ts
import { apiClient } from './client'

export interface BoardPosition {
  id: string
  name: string
  classification_id: string | null
  classification_abbr: string | null
  sort_order: number
  board_date: string | null
  open_blocks: boolean[]
  required_qualifications: string[]
}

export interface BoardAssignment {
  id: string
  duty_position_id: string
  block_index: number
  user_id: string | null
  user_first_name: string | null
  user_last_name: string | null
  status: 'assigned' | 'ot_needed'
}

export interface DutyBoardResponse {
  date: string
  positions: BoardPosition[]
  assignments: BoardAssignment[]
}

export interface AvailableEmployee {
  user_id: string
  first_name: string
  last_name: string
  shift_name: string
  shift_start: string
  shift_end: string
  is_overtime: boolean
  console_hours_this_month: number
  already_assigned_position: string | null
}

export interface ConsoleHoursEntry {
  user_id: string
  first_name: string
  last_name: string
  position_id: string
  position_name: string
  hours: number
}

export interface Qualification {
  id: string
  org_id: string
  name: string
  description: string | null
  created_at: string
}

export interface UserQualificationView {
  user_id: string
  qualification_id: string
  qualification_name: string
  granted_at: string
}

export interface DutyPositionHours {
  id: string
  duty_position_id: string
  day_of_week: number
  open_time: string
  close_time: string
  crosses_midnight: boolean
}

export const dutyBoardApi = {
  // Board aggregate endpoint
  getBoard: (date: string) =>
    apiClient.get<DutyBoardResponse>(`/api/duty-board/${date}`),

  // Cell actions
  cellAction: (date: string, body: {
    duty_position_id: string
    block_index: number
    action: 'assign' | 'mark_ot' | 'clear'
    user_id?: string
  }) => apiClient.post(`/api/duty-board/${date}/cells`, body),

  // Available staff for a block
  getAvailable: (date: string, params: { block_index: number; duty_position_id: string }) =>
    apiClient.get<AvailableEmployee[]>(`/api/duty-board/${date}/available`, { params }),

  // Console hours report
  getConsoleHours: (params: { start_date: string; end_date: string }) =>
    apiClient.get<ConsoleHoursEntry[]>('/api/duty-board/console-hours', { params }),

  // Qualifications CRUD
  listQualifications: () =>
    apiClient.get<Qualification[]>('/api/qualifications'),

  createQualification: (body: { name: string; description?: string }) =>
    apiClient.post<Qualification>('/api/qualifications', body),

  updateQualification: (id: string, body: { name?: string; description?: string | null }) =>
    apiClient.patch<Qualification>(`/api/qualifications/${id}`, body),

  deleteQualification: (id: string) =>
    apiClient.delete(`/api/qualifications/${id}`),

  // Position qualifications
  listPositionQualifications: (positionId: string) =>
    apiClient.get<Qualification[]>(`/api/duty-positions/${positionId}/qualifications`),

  addPositionQualification: (positionId: string, qualificationId: string) =>
    apiClient.post(`/api/duty-positions/${positionId}/qualifications`, { qualification_id: qualificationId }),

  removePositionQualification: (positionId: string, qualificationId: string) =>
    apiClient.delete(`/api/duty-positions/${positionId}/qualifications/${qualificationId}`),

  // User qualifications
  listUserQualifications: (userId: string) =>
    apiClient.get<UserQualificationView[]>(`/api/users/${userId}/qualifications`),

  addUserQualification: (userId: string, qualificationId: string) =>
    apiClient.post(`/api/users/${userId}/qualifications`, { qualification_id: qualificationId }),

  removeUserQualification: (userId: string, qualificationId: string) =>
    apiClient.delete(`/api/users/${userId}/qualifications/${qualificationId}`),

  // Position hours
  listPositionHours: (positionId: string) =>
    apiClient.get<DutyPositionHours[]>(`/api/duty-positions/${positionId}/hours`),

  setPositionHours: (positionId: string, body: {
    day_of_week: number
    open_time: string
    close_time: string
    crosses_midnight?: boolean
  }) => apiClient.post<DutyPositionHours>(`/api/duty-positions/${positionId}/hours`, body),

  deletePositionHours: (hoursId: string) =>
    apiClient.delete(`/api/duty-position-hours/${hoursId}`),
}
