import { api } from './client'
import type { Role, EmployeeType, UserProfile } from '../store/auth'

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
  seniority_date?: string
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
  seniority_date?: string | null
}

export const usersApi = {
  list: (params?: { include_inactive?: boolean }) =>
    api.get<UserProfile[]>('/api/users', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<UserProfile>(`/api/users/${id}`).then((r) => r.data),

  create: (body: CreateUserRequest) =>
    api.post<UserProfile>('/api/users', body).then((r) => r.data),

  update: (id: string, body: UpdateUserRequest) =>
    api.put<UserProfile>(`/api/users/${id}`, body).then((r) => r.data),

  deactivate: (id: string) =>
    api.delete(`/api/users/${id}`).then((r) => r.data),
}
