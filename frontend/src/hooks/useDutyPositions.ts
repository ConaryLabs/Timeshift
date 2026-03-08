// frontend/src/hooks/useDutyPositions.ts
import { useQuery } from '@tanstack/react-query'
import { dutyPositionsApi } from '@/api/dutyPositions'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useDutyPositions() {
  return useQuery({
    queryKey: queryKeys.dutyPositions.all,
    queryFn: dutyPositionsApi.list,
  })
}

export function useCreateDutyPosition() {
  return useInvalidatingMutation(dutyPositionsApi.create, [queryKeys.dutyPositions.all])
}

export function useUpdateDutyPosition() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; name?: string; classification_id?: string | null; sort_order?: number; is_active?: boolean }) =>
      dutyPositionsApi.update(id, body),
    [queryKeys.dutyPositions.all],
  )
}

export function useDeleteDutyPosition() {
  return useInvalidatingMutation(dutyPositionsApi.delete, [queryKeys.dutyPositions.all])
}
