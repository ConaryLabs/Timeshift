// frontend/src/api/leaveBalances.ts
import { apiClient } from './client'

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
  bargaining_unit: string | null
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
    apiClient.get<LeaveBalanceView[]>('/api/leave/balances', { params: userId ? { user_id: userId } : {} }),

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
    apiClient.get<AccrualTransaction[]>(`/api/leave/balances/${userId}/history`, { params }),

  adjust: (body: { user_id: string; leave_type_id: string; hours: number; note?: string }) =>
    apiClient.post('/api/leave/balances/adjust', body),

  listAccrualSchedules: () =>
    apiClient.get<AccrualSchedule[]>('/api/leave/accrual-schedules'),

  createAccrualSchedule: (body: {
    leave_type_id: string
    employee_type?: string
    bargaining_unit?: string | null
    years_of_service_min?: number
    years_of_service_max?: number
    hours_per_pay_period: number
    max_balance_hours?: number
    effective_date?: string
  }) => apiClient.post<AccrualSchedule>('/api/leave/accrual-schedules', body),

  updateAccrualSchedule: (
    id: string,
    body: {
      hours_per_pay_period?: number
      max_balance_hours?: number | null
      years_of_service_min?: number
      years_of_service_max?: number | null
    },
  ) => apiClient.patch<AccrualSchedule>(`/api/leave/accrual-schedules/${id}`, body),

  deleteAccrualSchedule: (id: string) =>
    apiClient.delete(`/api/leave/accrual-schedules/${id}`),
}
