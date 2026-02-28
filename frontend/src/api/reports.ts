import { apiClient } from './client'

export interface CoverageReport {
  date: string
  shift_template_id: string
  shift_name: string
  required_headcount: number
  actual_headcount: number
  coverage_percent: number
  status: 'over' | 'met' | 'under' | 'critical'
}

export interface OtSummaryReport {
  user_id: string
  first_name: string
  last_name: string
  classification_name: string | null
  hours_worked: number
  hours_declined: number
  total_hours: number
}

export interface LeaveSummaryReport {
  leave_type_code: string
  leave_type_name: string
  total_requests: number
  approved_count: number
  denied_count: number
  pending_count: number
  total_hours: number
}

export interface OtByPeriodEntry {
  date: string
  hours: number
  ot_type: string | null
}

export interface OtByPeriodReport {
  user_id: string
  user_name: string
  classification_name: string | null
  total_hours: number
  assignments: OtByPeriodEntry[]
}

export interface WorkSummaryReport {
  user_id: string
  user_name: string
  period: string
  regular_shifts: number
  ot_shifts: number
  leave_days: number
  total_hours: number
}

export const reportsApi = {
  coverage: (params: { start_date: string; end_date: string; team_id?: string }) =>
    apiClient.get<CoverageReport[]>('/api/reports/coverage', { params }),

  otSummary: (params?: { fiscal_year?: number; classification_id?: string }) =>
    apiClient.get<OtSummaryReport[]>('/api/reports/ot-summary', { params }),

  leaveSummary: (params: { start_date: string; end_date: string }) =>
    apiClient.get<LeaveSummaryReport[]>('/api/reports/leave-summary', { params }),

  otByPeriod: (params: { start_date: string; end_date: string; classification_id?: string }) =>
    apiClient.get<OtByPeriodReport[]>('/api/reports/ot-by-period', { params }),

  workSummary: (params: { start_date: string; end_date: string; user_id?: string }) =>
    apiClient.get<WorkSummaryReport[]>('/api/reports/work-summary', { params }),
}
