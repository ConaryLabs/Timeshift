import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vacationBidsApi } from '@/api/vacationBids'
import { queryKeys } from './queryKeys'

export function useVacationBidPeriods(year?: number) {
  return useQuery({
    queryKey: queryKeys.vacationBids.periods(year),
    queryFn: () => vacationBidsApi.listPeriods(year),
  })
}

export function useVacationBidWindows(periodId: string) {
  return useQuery({
    queryKey: queryKeys.vacationBids.windows(periodId),
    queryFn: () => vacationBidsApi.listWindows(periodId),
    enabled: !!periodId,
  })
}

export function useVacationBidWindow(windowId: string) {
  return useQuery({
    queryKey: queryKeys.vacationBids.window(windowId),
    queryFn: () => vacationBidsApi.getWindow(windowId),
    enabled: !!windowId,
  })
}

export function useCreateVacationBidPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vacationBidsApi.createPeriod,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vacationBids.all }),
  })
}

export function useDeleteVacationBidPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vacationBidsApi.deletePeriod,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vacationBids.all }),
  })
}

export function useOpenVacationBidding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; window_duration_hours: number; start_at?: string }) =>
      vacationBidsApi.openBidding(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vacationBids.all }),
  })
}

export function useSubmitVacationBid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ windowId, picks }: { windowId: string; picks: { start_date: string; end_date: string; preference_rank: number }[] }) =>
      vacationBidsApi.submitBid(windowId, { picks }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.vacationBids.window(vars.windowId) })
      qc.invalidateQueries({ queryKey: queryKeys.vacationBids.all })
    },
  })
}

export function useProcessVacationBids() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vacationBidsApi.processBids,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vacationBids.all })
      qc.invalidateQueries({ queryKey: queryKeys.leave.all })
    },
  })
}
