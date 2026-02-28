import { apiClient } from './client'
import type { Role, EmployeeType, EmployeeStatus, UserProfile } from '../store/auth'

export interface CreateUserRequest {
  employee_id?: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  role: Role
  classification_id?: string
  employee_type?: EmployeeType
  hire_date?: string
  overall_seniority_date?: string
  bargaining_unit_seniority_date?: string
  classification_seniority_date?: string
  password: string
}

export interface UpdateUserRequest {
  employee_id?: string | null
  first_name?: string
  last_name?: string
  email?: string
  phone?: string | null
  role?: Role
  classification_id?: string | null
  employee_type?: EmployeeType
  hire_date?: string | null
  overall_seniority_date?: string | null
  bargaining_unit_seniority_date?: string | null
  classification_seniority_date?: string | null
  medical_ot_exempt?: boolean
  employee_status?: EmployeeStatus
  /** Pass true when setting a pausing status for OJI/maternity/military (seniority not paused). */
  seniority_pause_exception?: boolean
  /** Optimistic locking: if set, backend rejects with 409 when record has changed. */
  expected_updated_at?: string
}

export interface UserDirectoryEntry {
  id: string
  first_name: string
  last_name: string
}

export const usersApi = {
  list: (params?: { include_inactive?: boolean; limit?: number; offset?: number }) =>
    apiClient.get<UserProfile[]>('/api/users', { params }),

  directory: () =>
    apiClient.get<UserDirectoryEntry[]>('/api/users/directory'),

  get: (id: string) =>
    apiClient.get<UserProfile>(`/api/users/${id}`),

  create: (body: CreateUserRequest) =>
    apiClient.post<UserProfile>('/api/users', body),

  update: (id: string, body: UpdateUserRequest) =>
    apiClient.patch<UserProfile>(`/api/users/${id}`, body),

  deactivate: (id: string) =>
    apiClient.delete(`/api/users/${id}`),

  activate: (id: string) =>
    apiClient.post<{ ok: boolean }>(`/api/users/${id}/activate`),

  changePassword: (body: { current_password: string; new_password: string }) =>
    apiClient.patch<{ ok: boolean }>('/api/users/me/password', body),
}
