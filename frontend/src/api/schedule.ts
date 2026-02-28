import { apiClient } from './client'

export interface ShiftTemplate {
  id: string
  org_id: string
  name: string
  start_time: string
  end_time: string
  crosses_midnight: boolean
  duration_minutes: number
  color: string
  is_active: boolean
  created_at: string
  /** Present when backend returns it; used for optimistic locking. */
  updated_at?: string
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
  employee_id: string | null
  first_name: string
  last_name: string
  position: string | null
  is_overtime: boolean
  is_trade: boolean
  team_name: string | null
  classification_abbreviation: string | null
  notes: string | null
}

// -- Grid / Day / Dashboard types --

export interface GridAssignment {
  assignment_id: string
  user_id: string
  employee_id: string | null
  first_name: string
  last_name: string
  classification_abbreviation: string | null
  is_overtime: boolean
  is_trade: boolean
  notes?: string | null
}

export interface ClassificationCoverageDetail {
  classification_abbreviation: string
  shortage: number
}

export interface GridCell {
  date: string
  shift_template_id: string
  shift_name: string
  shift_color: string
  assignments: GridAssignment[]
  leave_count: number
  coverage_required: number
  coverage_actual: number
  coverage_by_classification?: ClassificationCoverageDetail[]
}

export interface DayViewEntry {
  shift_template_id: string
  shift_name: string
  shift_color: string
  start_time: string
  end_time: string
  crosses_midnight: boolean
  assignments: GridAssignment[]
  coverage_required: number
  coverage_actual: number
  coverage_status: 'green' | 'yellow' | 'red'
  coverage_by_classification?: ClassificationCoverageDetail[]
}

export interface ScheduleAnnotation {
  id: string
  org_id: string
  date: string
  shift_template_id: string | null
  content: string
  annotation_type: 'note' | 'alert' | 'holiday'
  created_by: string
  created_at: string
}

export interface DashboardData {
  current_coverage: DayViewEntry[]
  pending_leave_count: number
  open_callout_count: number
  annotations: ScheduleAnnotation[]
}

export const scheduleApi = {
  getTemplates: () =>
    apiClient.get<ShiftTemplate[]>('/api/shifts/templates'),

  createTemplate: (body: {
    name: string
    start_time: string
    end_time: string
    color?: string
  }) => apiClient.post<ShiftTemplate>('/api/shifts/templates', body),

  updateTemplate: (id: string, body: { name?: string; color?: string; is_active?: boolean; expected_updated_at?: string }) =>
    apiClient.patch<ShiftTemplate>(`/api/shifts/templates/${id}`, body),

  getStaffing: (start_date: string, end_date: string, team_id?: string) =>
    apiClient.get<AssignmentView[]>('/api/schedule', {
      params: { start_date, end_date, ...(team_id ? { team_id } : {}) },
    }),

  createAssignment: (body: {
    scheduled_shift_id: string
    user_id: string
    position?: string
    is_overtime?: boolean
    is_trade?: boolean
    notes?: string
  }) => apiClient.post('/api/schedule/assignments', body),

  deleteAssignment: (id: string) =>
    apiClient.delete(`/api/schedule/assignments/${id}`),

  // Grid view
  getGrid: (start_date: string, end_date: string, team_id?: string) =>
    apiClient.get<GridCell[]>('/api/schedule/grid', {
      params: { start_date, end_date, ...(team_id ? { team_id } : {}) },
    }),

  // Day view
  getDayView: (date: string) =>
    apiClient.get<DayViewEntry[]>(`/api/schedule/day/${date}`),

  // Dashboard
  getDashboard: () =>
    apiClient.get<DashboardData>('/api/schedule/dashboard'),

  // Annotations
  listAnnotations: (start_date: string, end_date: string) =>
    apiClient.get<ScheduleAnnotation[]>('/api/schedule/annotations', {
      params: { start_date, end_date },
    }),

  createAnnotation: (body: {
    date: string
    shift_template_id?: string
    content: string
    annotation_type: string
  }) => apiClient.post<ScheduleAnnotation>('/api/schedule/annotations', body),

  deleteAnnotation: (id: string) =>
    apiClient.delete(`/api/schedule/annotations/${id}`),
}
