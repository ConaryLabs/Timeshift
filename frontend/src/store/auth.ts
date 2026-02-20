import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'admin' | 'supervisor' | 'employee'

export type EmployeeType =
  | 'regular_full_time'
  | 'job_share'
  | 'medical_part_time'
  | 'temp_part_time'

export interface UserProfile {
  id: string
  org_id: string
  employee_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  role: Role
  classification_id: string | null
  classification_name: string | null
  employee_type: EmployeeType
  hire_date: string | null
  seniority_date: string | null
  is_active: boolean
}

interface AuthState {
  token: string | null
  user: UserProfile | null
  setAuth: (token: string, user: UserProfile) => void
  setUser: (user: UserProfile) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'timeshift-auth',
      version: 1,
      migrate: (persistedState) => {
        return persistedState as AuthState
      },
    },
  ),
)
