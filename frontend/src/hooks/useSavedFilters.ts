import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { savedFiltersApi } from '@/api/savedFilters'
import { queryKeys } from './queryKeys'

export function useSavedFilters(page: string) {
  return useQuery({
    queryKey: queryKeys.savedFilters.byPage(page),
    queryFn: () => savedFiltersApi.list(page),
    enabled: !!page,
  })
}

export function useCreateSavedFilter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: savedFiltersApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.savedFilters.all }),
  })
}

export function useDeleteSavedFilter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: savedFiltersApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.savedFilters.all }),
  })
}

export function useSetSavedFilterDefault() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_default }: { id: string; is_default: boolean }) =>
      savedFiltersApi.setDefault(id, is_default),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.savedFilters.all }),
  })
}
