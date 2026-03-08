// frontend/src/hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/store/auth'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useUsers(params?: { include_inactive?: boolean; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersApi.list(params),
  })
}

export function useUserDirectory() {
  return useQuery({
    queryKey: queryKeys.users.directory,
    queryFn: usersApi.directory,
  })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => usersApi.get(id),
    enabled: !!id,
  })
}

export function useCreateUser() {
  return useInvalidatingMutation(usersApi.create, [queryKeys.users.all])
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Parameters<typeof usersApi.update>[1] & { id: string }) =>
      usersApi.update(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all })
      if (vars.id === useAuthStore.getState().user?.id) {
        qc.invalidateQueries({ queryKey: queryKeys.auth.me })
      }
    },
  })
}

export function useDeactivateUser() {
  return useInvalidatingMutation(usersApi.deactivate, [queryKeys.users.all])
}

export function useActivateUser() {
  return useInvalidatingMutation(usersApi.activate, [queryKeys.users.all])
}
