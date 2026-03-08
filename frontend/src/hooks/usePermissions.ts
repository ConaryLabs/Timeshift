// frontend/src/hooks/usePermissions.ts
import { useAuthStore, type Role } from '@/store/auth'

export function usePermissions() {
  const user = useAuthStore((s) => s.user)
  const role = user?.role ?? null

  const isAdmin = role === 'admin'
  const isManager = isAdmin || role === 'supervisor'

  return {
    role,
    isAdmin,
    isSupervisor: role === 'supervisor',
    isManager,
    canManageUsers: isAdmin,
    hasRole: (required: Role | Role[]) => {
      if (!role) return false
      const roles = Array.isArray(required) ? required : [required]
      return roles.includes(role)
    },
  }
}
