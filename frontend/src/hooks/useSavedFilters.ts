// frontend/src/hooks/useSavedFilters.ts
import { useQuery } from '@tanstack/react-query'
import { savedFiltersApi } from '@/api/savedFilters'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useSavedFilters(page: string) {
  return useQuery({
    queryKey: queryKeys.savedFilters.byPage(page),
    queryFn: () => savedFiltersApi.list(page),
    enabled: !!page,
  })
}

export function useCreateSavedFilter() {
  return useInvalidatingMutation(savedFiltersApi.create, [queryKeys.savedFilters.all])
}

export function useDeleteSavedFilter() {
  return useInvalidatingMutation(savedFiltersApi.delete, [queryKeys.savedFilters.all])
}

export function useSetSavedFilterDefault() {
  return useInvalidatingMutation(
    ({ id, is_default }: { id: string; is_default: boolean }) =>
      savedFiltersApi.setDefault(id, is_default),
    [queryKeys.savedFilters.all],
  )
}
