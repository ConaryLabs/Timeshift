// frontend/src/hooks/useInvalidatingMutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryKey, MutationFunction, UseMutationOptions } from '@tanstack/react-query'

/**
 * Wrapper around useMutation that automatically invalidates the given query keys on success.
 * Use for simple mutations that just need cache invalidation (no optimistic updates).
 */
export function useInvalidatingMutation<TData = unknown, TVariables = void>(
  mutationFn: MutationFunction<TData, TVariables>,
  invalidateKeys: QueryKey[],
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn' | 'onSuccess'>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of invalidateKeys) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
    ...options,
  })
}
