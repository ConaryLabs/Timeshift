import { useQuery } from '@tanstack/react-query'
import { holidaysApi } from '@/api/holidays'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useHolidays(year?: number) {
  return useQuery({
    queryKey: queryKeys.holidays.list(year),
    queryFn: () => holidaysApi.list(year),
  })
}

export function useCreateHoliday() {
  return useInvalidatingMutation(holidaysApi.create, [queryKeys.holidays.all])
}

export function useUpdateHoliday() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; name?: string; is_premium_pay?: boolean }) =>
      holidaysApi.update(id, body),
    [queryKeys.holidays.all],
  )
}

export function useDeleteHoliday() {
  return useInvalidatingMutation(holidaysApi.delete, [queryKeys.holidays.all])
}
