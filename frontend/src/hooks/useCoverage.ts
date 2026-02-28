import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { coveragePlansApi } from '@/api/coveragePlans'
import type { SlotEntry } from '@/api/coveragePlans'
import { queryKeys } from './queryKeys'

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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coveragePlansApi.createPlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.list }),
  })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coveragePlansApi.deletePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.list }),
  })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coveragePlansApi.createAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.assignments })
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.all })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.dashboard })
    },
  })
}

export function useDeleteCoveragePlanAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coveragePlansApi.deleteAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.assignments })
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.all })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.dashboard })
    },
  })
}

export function useResolvedCoverage(date: string) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.resolved(date),
    queryFn: () => coveragePlansApi.getResolved(date),
    enabled: !!date,
    staleTime: 30_000,
  })
}

export function useCoverageGaps(date: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.gaps(date),
    queryFn: () => coveragePlansApi.getGaps(date),
    enabled: (options?.enabled ?? true) && !!date,
    staleTime: 30_000,
  })
}

export function useCoverageGapBlocks(date: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.gapBlocks(date),
    queryFn: () => coveragePlansApi.getGapBlocks(date),
    enabled: (options?.enabled ?? true) && !!date,
    staleTime: 30_000,
  })
}

export function useSendSmsAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, classification_id }: { date: string; classification_id?: string }) =>
      coveragePlansApi.sendSmsAlert(date, classification_id ? { classification_id } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.all })
    },
  })
}

export function useDayGrid(date: string) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.dayGrid(date),
    queryFn: () => coveragePlansApi.dayGrid(date),
    enabled: !!date,
    staleTime: 30_000,
  })
}
