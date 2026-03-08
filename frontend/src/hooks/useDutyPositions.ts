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

export function useDutyAssignments(date: string, shiftTemplateId?: string) {
  return useQuery({
    queryKey: queryKeys.dutyPositions.assignments(date, shiftTemplateId),
    queryFn: () => dutyPositionsApi.listAssignments({ date, shift_template_id: shiftTemplateId }),
    enabled: !!date,
  })
}

export function useCreateDutyAssignment() {
  return useInvalidatingMutation(dutyPositionsApi.createAssignment, [
    queryKeys.dutyPositions.all,
    queryKeys.dutyPositions.assignmentsAll,
    queryKeys.dutyBoard.all,
  ])
}

export function useUpdateDutyAssignment() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; user_id?: string; notes?: string | null }) =>
      dutyPositionsApi.updateAssignment(id, body),
    [queryKeys.dutyPositions.all, queryKeys.dutyPositions.assignmentsAll, queryKeys.dutyBoard.all],
  )
}

export function useDeleteDutyAssignment() {
  return useInvalidatingMutation(dutyPositionsApi.deleteAssignment, [
    queryKeys.dutyPositions.all,
    queryKeys.dutyPositions.assignmentsAll,
    queryKeys.dutyBoard.all,
  ])
}
