import { useQuery } from '@tanstack/react-query'
import { shiftPatternsApi } from '@/api/shiftPatterns'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useShiftPatterns() {
  return useQuery({
    queryKey: queryKeys.shiftPatterns.all,
    queryFn: shiftPatternsApi.list,
  })
}

export function useCreateShiftPattern() {
  return useInvalidatingMutation(shiftPatternsApi.create, [queryKeys.shiftPatterns.all])
}

export function useUpdateShiftPattern() {
  return useInvalidatingMutation(
    ({ id, ...data }: { id: string; name?: string; pattern_days?: number; work_days?: number; off_days?: number; anchor_date?: string; team_id?: string | null; is_active?: boolean; work_days_in_cycle?: number[] | null }) =>
      shiftPatternsApi.update(id, data),
    [queryKeys.shiftPatterns.all],
  )
}

export function useDeleteShiftPattern() {
  return useInvalidatingMutation(shiftPatternsApi.delete, [queryKeys.shiftPatterns.all])
}

export function useShiftPatternCycle(id: string, date: string) {
  return useQuery({
    queryKey: queryKeys.shiftPatterns.cycle(id, date),
    queryFn: () => shiftPatternsApi.cycle(id, date),
    enabled: !!id && !!date,
  })
}

export function useShiftPatternAssignments() {
  return useQuery({
    queryKey: queryKeys.shiftPatterns.assignments,
    queryFn: shiftPatternsApi.listAssignments,
  })
}

export function useCreateShiftPatternAssignment() {
  return useInvalidatingMutation(shiftPatternsApi.createAssignment, [queryKeys.shiftPatterns.assignments])
}

export function useDeleteShiftPatternAssignment() {
  return useInvalidatingMutation(shiftPatternsApi.deleteAssignment, [queryKeys.shiftPatterns.assignments])
}
