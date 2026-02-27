import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { holidaysApi } from '@/api/holidays'
import { queryKeys } from './queryKeys'

export function useHolidays(year?: number) {
  return useQuery({
    queryKey: queryKeys.holidays.list(year),
    queryFn: () => holidaysApi.list(year),
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: holidaysApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.holidays.all }),
  })
}

export function useUpdateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; is_premium_pay?: boolean }) =>
      holidaysApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.holidays.all }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: holidaysApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.holidays.all }),
  })
}
