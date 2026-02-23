import { api } from './client'

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

export interface OrgSetting {
  id: string
  org_id: string
  key: string
  value: unknown
  updated_at: string
}

export const reportsApi = {
  coverage: (params: { start_date: string; end_date: string; team_id?: string }) =>
    api.get<CoverageReport[]>('/api/reports/coverage', { params }).then((r) => r.data),

  otSummary: (params?: { fiscal_year?: number; classification_id?: string }) =>
    api.get<OtSummaryReport[]>('/api/reports/ot-summary', { params }).then((r) => r.data),

  leaveSummary: (params: { start_date: string; end_date: string }) =>
    api.get<LeaveSummaryReport[]>('/api/reports/leave-summary', { params }).then((r) => r.data),

  listSettings: () =>
    api.get<OrgSetting[]>('/api/organization/settings').then((r) => r.data),

  setSetting: (body: { key: string; value: unknown }) =>
    api.put<OrgSetting>('/api/organization/settings', body).then((r) => r.data),
}
