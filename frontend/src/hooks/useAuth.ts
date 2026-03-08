// frontend/src/hooks/useAuth.ts
import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { queryKeys } from './queryKeys'

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser)
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const profile = await authApi.me()
      setUser(profile)
      return profile
    },
    staleTime: 60 * 1000,
    retry: false,
  })
}
