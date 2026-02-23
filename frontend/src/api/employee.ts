import { api } from './client'

export interface EmployeePreferences {
  id: string
  user_id: string
  notification_email: boolean
  notification_sms: boolean
  preferred_view: 'month' | 'week' | 'day'
  created_at: string
  updated_at: string
}

export interface UpdatePreferencesRequest {
  notification_email?: boolean
  notification_sms?: boolean
  preferred_view?: 'month' | 'week' | 'day'
}

export interface MyScheduleEntry {
  date: string
  shift_name: string
  shift_color: string
  start_time: string
  end_time: string
  crosses_midnight: boolean
  team_name: string | null
  position: string | null
  is_overtime: boolean
  is_trade: boolean
  notes: string | null
}

export interface LeaveBalanceSummary {
  leave_type_code: string
  leave_type_name: string
  balance_hours: number
}

export interface MyDashboardData {
  today_shift: MyScheduleEntry | null
  next_shift: MyScheduleEntry | null
  upcoming_shifts: MyScheduleEntry[]
  leave_balances: LeaveBalanceSummary[]
  pending_leave_count: number
  pending_trade_count: number
}

export const employeeApi = {
  getPreferences: () =>
    api.get<EmployeePreferences>('/api/users/me/preferences').then((r) => r.data),

  updatePreferences: (body: UpdatePreferencesRequest) =>
    api.patch<EmployeePreferences>('/api/users/me/preferences', body).then((r) => r.data),

  getSchedule: (startDate: string, endDate: string) =>
    api
      .get<MyScheduleEntry[]>('/api/users/me/schedule', {
        params: { start_date: startDate, end_date: endDate },
      })
      .then((r) => r.data),

  getDashboard: () =>
    api.get<MyDashboardData>('/api/users/me/dashboard').then((r) => r.data),
}
