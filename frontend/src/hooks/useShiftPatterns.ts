import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shiftPatternsApi } from '@/api/shiftPatterns'
import { queryKeys } from './queryKeys'

export function useShiftPatterns() {
  return useQuery({
    queryKey: queryKeys.shiftPatterns.all,
    queryFn: shiftPatternsApi.list,
  })
}

export function useCreateShiftPattern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: shiftPatternsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shiftPatterns.all }),
  })
}

export function useUpdateShiftPattern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; pattern_days?: number; work_days?: number; off_days?: number; anchor_date?: string; team_id?: string | null; is_active?: boolean; work_days_in_cycle?: number[] | null }) =>
      shiftPatternsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shiftPatterns.all }),
  })
}

export function useDeleteShiftPattern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: shiftPatternsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shiftPatterns.all }),
  })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: shiftPatternsApi.createAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shiftPatterns.assignments }),
  })
}

export function useDeleteShiftPatternAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: shiftPatternsApi.deleteAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shiftPatterns.assignments }),
  })
}
