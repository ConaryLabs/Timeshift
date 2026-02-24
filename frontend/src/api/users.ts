import { api } from './client'
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
  is_active?: boolean
  employee_status?: EmployeeStatus
  /** Pass true when setting a pausing status for OJI/maternity/military (seniority not paused). */
  seniority_pause_exception?: boolean
}

export interface UserDirectoryEntry {
  id: string
  first_name: string
  last_name: string
}

export const usersApi = {
  list: (params?: { include_inactive?: boolean; limit?: number; offset?: number }) =>
    api.get<UserProfile[]>('/api/users', { params }).then((r) => r.data),

  directory: () =>
    api.get<UserDirectoryEntry[]>('/api/users/directory').then((r) => r.data),

  get: (id: string) =>
    api.get<UserProfile>(`/api/users/${id}`).then((r) => r.data),

  create: (body: CreateUserRequest) =>
    api.post<UserProfile>('/api/users', body).then((r) => r.data),

  update: (id: string, body: UpdateUserRequest) =>
    api.patch<UserProfile>(`/api/users/${id}`, body).then((r) => r.data),

  deactivate: (id: string) =>
    api.delete(`/api/users/${id}`).then((r) => r.data),

  changePassword: (body: { current_password: string; new_password: string }) =>
    api.patch<{ ok: boolean }>('/api/users/me/password', body).then((r) => r.data),
}
