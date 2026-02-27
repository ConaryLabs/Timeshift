import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { biddingApi } from '@/api/bidding'
import { queryKeys } from './queryKeys'

export function useBidWindows(periodId: string) {
  return useQuery({
    queryKey: queryKeys.bidding.windows(periodId),
    queryFn: () => biddingApi.listBidWindows(periodId),
    enabled: !!periodId,
  })
}

export function useBidWindow(windowId: string) {
  return useQuery({
    queryKey: queryKeys.bidding.window(windowId),
    queryFn: () => biddingApi.getBidWindow(windowId),
    enabled: !!windowId,
  })
}

export function useOpenBidding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ periodId, ...body }: { periodId: string; window_duration_hours: number; start_at?: string }) =>
      biddingApi.openBidding(periodId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.periods.all })
      qc.invalidateQueries({ queryKey: queryKeys.bidding.windows(vars.periodId) })
    },
  })
}

export function useSubmitBid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ windowId, preferences }: { windowId: string; preferences: { slot_id: string; preference_rank: number }[] }) =>
      biddingApi.submitBid(windowId, { preferences }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.bidding.window(vars.windowId) })
    },
  })
}

export function useProcessBids() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: biddingApi.processBids,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.periods.all })
      qc.invalidateQueries({ queryKey: queryKeys.bidding.all })
    },
  })
}

export function useApproveBidWindow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (windowId: string) => biddingApi.approveBidWindow(windowId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.bidding.all })
    },
  })
}
