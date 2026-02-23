import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'admin' | 'supervisor' | 'employee'

export type EmployeeType =
  | 'regular_full_time'
  | 'job_share'
  | 'medical_part_time'
  | 'temp_part_time'

export type EmployeeStatus = 'active' | 'unpaid_loa' | 'lwop' | 'layoff' | 'separated'

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
  overall_seniority_date: string | null
  bargaining_unit_seniority_date: string | null
  classification_seniority_date: string | null
  cto_designation: boolean
  admin_training_supervisor_since: string | null
  bargaining_unit: 'vccea' | 'vcsg' | 'non_represented'
  employee_status: EmployeeStatus
  accrual_paused_since: string | null
  is_active: boolean
}

interface AuthState {
  user: UserProfile | null
  /** @deprecated Use setUser instead */
  setAuth: (user: UserProfile) => void
  setUser: (user: UserProfile) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => {
      const setUser = (user: UserProfile) => set({ user })
      return {
        user: null,
        setAuth: setUser,
        setUser,
        logout: () => set({ user: null }),
      }
    },
    {
      name: 'timeshift-auth',
      version: 2,
      migrate: () => ({ user: null }),
    },
  ),
)
