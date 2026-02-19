import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'admin' | 'supervisor' | 'employee'

export interface UserProfile {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  role: Role
  position: string
  unit: string | null
  seniority_date: string
  is_active: boolean
}

interface AuthState {
  token: string | null
  user: UserProfile | null
  setAuth: (token: string, user: UserProfile) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'timeshift-auth' },
  ),
)
