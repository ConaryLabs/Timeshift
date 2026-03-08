// frontend/src/hooks/useBidding.ts
import { useQuery } from '@tanstack/react-query'
import { biddingApi } from '@/api/bidding'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

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
  return useInvalidatingMutation(
    ({ periodId, ...body }: { periodId: string; window_duration_hours: number; start_at?: string }) =>
      biddingApi.openBidding(periodId, body),
    [queryKeys.periods.all, queryKeys.bidding.all],
  )
}

export function useSubmitBid() {
  return useInvalidatingMutation(
    ({ windowId, preferences }: { windowId: string; preferences: { slot_id: string; preference_rank: number }[] }) =>
      biddingApi.submitBid(windowId, { preferences }),
    [queryKeys.bidding.all],
  )
}

export function useProcessBids() {
  return useInvalidatingMutation(biddingApi.processBids, [
    queryKeys.periods.all,
    queryKeys.bidding.all,
  ])
}

export function useApproveBidWindow() {
  return useInvalidatingMutation(biddingApi.approveBidWindow, [queryKeys.bidding.all])
}
