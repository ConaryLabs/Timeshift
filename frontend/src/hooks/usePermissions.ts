import { useAuthStore, type Role } from '@/store/auth'

export function usePermissions() {
  const user = useAuthStore((s) => s.user)
  const role = user?.role ?? 'employee'

  return {
    role,
    isAdmin: role === 'admin',
    isSupervisor: role === 'supervisor',
    isManager: role === 'admin' || role === 'supervisor',
    canManageSchedule: role === 'admin' || role === 'supervisor',
    canApproveLeave: role === 'admin' || role === 'supervisor',
    canManageUsers: role === 'admin',
    hasRole: (required: Role | Role[]) => {
      const roles = Array.isArray(required) ? required : [required]
      return roles.includes(role)
    },
  }
}
