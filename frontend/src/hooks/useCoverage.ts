// frontend/src/hooks/useCoverage.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { coveragePlansApi, type SlotEntry } from '@/api/coveragePlans'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useCoveragePlans() {
  return useQuery({
    queryKey: queryKeys.coveragePlans.list,
    queryFn: coveragePlansApi.listPlans,
  })
}

export function useCoveragePlan(id: string) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.detail(id),
    queryFn: () => coveragePlansApi.getPlan(id),
    enabled: !!id,
  })
}

export function useCreateCoveragePlan() {
  return useInvalidatingMutation(coveragePlansApi.createPlan, [queryKeys.coveragePlans.list])
}

export function useUpdateCoveragePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string; is_default?: boolean; is_active?: boolean }) =>
      coveragePlansApi.updatePlan(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.list })
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.detail(vars.id) })
    },
  })
}

export function useDeleteCoveragePlan() {
  return useInvalidatingMutation(coveragePlansApi.deletePlan, [queryKeys.coveragePlans.list])
}

export function useCoveragePlanSlots(planId: string) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.slots(planId),
    queryFn: () => coveragePlansApi.listSlots(planId),
    enabled: !!planId,
  })
}

export function useBulkUpsertSlots() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, slots }: { planId: string; slots: SlotEntry[] }) =>
      coveragePlansApi.bulkUpsertSlots(planId, slots),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.slots(vars.planId) })
    },
  })
}

export function useCoveragePlanAssignments() {
  return useQuery({
    queryKey: queryKeys.coveragePlans.assignments,
    queryFn: coveragePlansApi.listAssignments,
  })
}

export function useCreateCoveragePlanAssignment() {
  return useInvalidatingMutation(coveragePlansApi.createAssignment, [
    queryKeys.coveragePlans.assignments,
    queryKeys.coveragePlans.all,
    queryKeys.schedule.dashboard,
  ])
}

export function useDeleteCoveragePlanAssignment() {
  return useInvalidatingMutation(coveragePlansApi.deleteAssignment, [
    queryKeys.coveragePlans.assignments,
    queryKeys.coveragePlans.all,
    queryKeys.schedule.dashboard,
  ])
}

export function useResolvedCoverage(date: string) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.resolved(date),
    queryFn: () => coveragePlansApi.getResolved(date),
    enabled: !!date,
  })
}

export function useCoverageGaps(date: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.gaps(date),
    queryFn: () => coveragePlansApi.getGaps(date),
    enabled: (options?.enabled ?? true) && !!date,
  })
}

export function useCoverageGapBlocks(date: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.gapBlocks(date),
    queryFn: () => coveragePlansApi.getGapBlocks(date),
    enabled: (options?.enabled ?? true) && !!date,
  })
}

export function useSendSmsAlert() {
  return useInvalidatingMutation(
    ({ date, classification_id }: { date: string; classification_id?: string }) =>
      coveragePlansApi.sendSmsAlert(date, classification_id ? { classification_id } : undefined),
    [queryKeys.coveragePlans.all],
  )
}

export function useDayGrid(date: string) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.dayGrid(date),
    queryFn: () => coveragePlansApi.dayGrid(date),
    enabled: !!date,
  })
}
