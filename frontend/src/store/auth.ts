// frontend/src/store/auth.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { queryClient } from '@/lib/queryClient'
import { useUIStore } from './ui'

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
  bargaining_unit: string
  employee_status: EmployeeStatus
  accrual_paused_since: string | null
  leave_accrual_paused_at: string | null
  medical_ot_exempt: boolean
  is_active: boolean
  /** Present when backend returns it; used for optimistic locking. */
  updated_at?: string
}

interface AuthState {
  user: UserProfile | null
  setUser: (user: UserProfile) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user: UserProfile) => set({ user }),
      logout: () => {
        set({ user: null })
        queryClient.clear()
        useUIStore.getState().reset()
      },
    }),
    {
      name: 'timeshift-auth',
      version: 2,
      migrate: () => ({ user: null }),
    },
  ),
)
