import { api } from './client'

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
    api.get<DutyBoardResponse>(`/api/duty-board/${date}`).then((r) => r.data),

  // Cell actions
  cellAction: (date: string, body: {
    duty_position_id: string
    block_index: number
    action: 'assign' | 'mark_ot' | 'clear'
    user_id?: string
  }) => api.post(`/api/duty-board/${date}/cells`, body).then((r) => r.data),

  // Available staff for a block
  getAvailable: (date: string, params: { block_index: number; duty_position_id: string }) =>
    api.get<AvailableEmployee[]>(`/api/duty-board/${date}/available`, { params }).then((r) => r.data),

  // Console hours report
  getConsoleHours: (params: { start_date: string; end_date: string }) =>
    api.get<ConsoleHoursEntry[]>('/api/duty-board/console-hours', { params }).then((r) => r.data),

  // Qualifications CRUD
  listQualifications: () =>
    api.get<Qualification[]>('/api/qualifications').then((r) => r.data),

  createQualification: (body: { name: string; description?: string }) =>
    api.post<Qualification>('/api/qualifications', body).then((r) => r.data),

  updateQualification: (id: string, body: { name?: string; description?: string | null }) =>
    api.patch<Qualification>(`/api/qualifications/${id}`, body).then((r) => r.data),

  deleteQualification: (id: string) =>
    api.delete(`/api/qualifications/${id}`).then((r) => r.data),

  // Position qualifications
  listPositionQualifications: (positionId: string) =>
    api.get<Qualification[]>(`/api/duty-positions/${positionId}/qualifications`).then((r) => r.data),

  addPositionQualification: (positionId: string, qualificationId: string) =>
    api.post(`/api/duty-positions/${positionId}/qualifications`, { qualification_id: qualificationId }).then((r) => r.data),

  removePositionQualification: (positionId: string, qualificationId: string) =>
    api.delete(`/api/duty-positions/${positionId}/qualifications/${qualificationId}`).then((r) => r.data),

  // User qualifications
  listUserQualifications: (userId: string) =>
    api.get<UserQualificationView[]>(`/api/users/${userId}/qualifications`).then((r) => r.data),

  addUserQualification: (userId: string, qualificationId: string) =>
    api.post(`/api/users/${userId}/qualifications`, { qualification_id: qualificationId }).then((r) => r.data),

  removeUserQualification: (userId: string, qualificationId: string) =>
    api.delete(`/api/users/${userId}/qualifications/${qualificationId}`).then((r) => r.data),

  // Position hours
  listPositionHours: (positionId: string) =>
    api.get<DutyPositionHours[]>(`/api/duty-positions/${positionId}/hours`).then((r) => r.data),

  setPositionHours: (positionId: string, body: {
    day_of_week: number
    open_time: string
    close_time: string
    crosses_midnight?: boolean
  }) => api.post<DutyPositionHours>(`/api/duty-positions/${positionId}/hours`, body).then((r) => r.data),

  deletePositionHours: (hoursId: string) =>
    api.delete(`/api/duty-position-hours/${hoursId}`).then((r) => r.data),
}
