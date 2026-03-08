// frontend/src/hooks/useTrades.ts
import { useQuery } from '@tanstack/react-query'
import { tradesApi, type TradeListParams } from '@/api/trades'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useTrades(params?: TradeListParams) {
  return useQuery({
    queryKey: queryKeys.trades.list(params),
    queryFn: () => tradesApi.list(params),
  })
}

export function useTrade(id: string) {
  return useQuery({
    queryKey: queryKeys.trades.detail(id),
    queryFn: () => tradesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateTrade() {
  return useInvalidatingMutation(tradesApi.create, [
    queryKeys.trades.all,
    queryKeys.nav.badges,
  ])
}

export function useRespondTrade() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; accept: boolean }) =>
      tradesApi.respond(id, body),
    [queryKeys.trades.all, queryKeys.nav.badges],
  )
}

export function useReviewTrade() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; status: 'approved' | 'denied'; reviewer_notes?: string }) =>
      tradesApi.review(id, body),
    [queryKeys.trades.all, queryKeys.schedule.all, queryKeys.nav.badges],
  )
}

export function useBulkReviewTrade() {
  return useInvalidatingMutation(tradesApi.bulkReview, [
    queryKeys.trades.all,
    queryKeys.schedule.all,
    queryKeys.nav.badges,
  ])
}

export function useCancelTrade() {
  return useInvalidatingMutation(tradesApi.cancel, [
    queryKeys.trades.all,
    queryKeys.nav.badges,
  ])
}
