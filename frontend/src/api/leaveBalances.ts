import { api } from './client'

export interface LeaveBalanceView {
  leave_type_id: string
  leave_type_code: string
  leave_type_name: string
  balance_hours: number
  as_of_date: string
}

export interface AccrualSchedule {
  id: string
  org_id: string
  leave_type_id: string
  employee_type: string
  years_of_service_min: number
  years_of_service_max: number | null
  hours_per_pay_period: number
  max_balance_hours: number | null
  effective_date: string
  created_at: string
}

export interface AccrualTransaction {
  id: string
  user_id: string
  leave_type_id: string
  hours: number
  reason: 'accrual' | 'usage' | 'adjustment' | 'carryover'
  reference_id: string | null
  note: string | null
  created_by: string
  created_at: string
}

export const leaveBalancesApi = {
  list: (userId?: string) =>
    api
      .get<LeaveBalanceView[]>('/api/leave/balances', { params: userId ? { user_id: userId } : {} })
      .then((r) => r.data),

  history: (
    userId: string,
    params?: {
      leave_type_id?: string
      start_date?: string
      end_date?: string
      limit?: number
      offset?: number
    },
  ) =>
    api
      .get<AccrualTransaction[]>(`/api/leave/balances/${userId}/history`, { params })
      .then((r) => r.data),

  adjust: (body: { user_id: string; leave_type_id: string; hours: number; note?: string }) =>
    api.post('/api/leave/balances/adjust', body).then((r) => r.data),

  listAccrualSchedules: () =>
    api.get<AccrualSchedule[]>('/api/leave/accrual-schedules').then((r) => r.data),

  createAccrualSchedule: (body: {
    leave_type_id: string
    employee_type?: string
    years_of_service_min?: number
    years_of_service_max?: number
    hours_per_pay_period: number
    max_balance_hours?: number
    effective_date?: string
  }) => api.post<AccrualSchedule>('/api/leave/accrual-schedules', body).then((r) => r.data),

  updateAccrualSchedule: (
    id: string,
    body: {
      hours_per_pay_period?: number
      max_balance_hours?: number | null
      years_of_service_min?: number
      years_of_service_max?: number | null
    },
  ) => api.put<AccrualSchedule>(`/api/leave/accrual-schedules/${id}`, body).then((r) => r.data),

  deleteAccrualSchedule: (id: string) =>
    api.delete(`/api/leave/accrual-schedules/${id}`).then((r) => r.data),
}
