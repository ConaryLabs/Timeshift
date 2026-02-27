import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tradesApi, type TradeListParams } from '@/api/trades'
import { queryKeys } from './queryKeys'

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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tradesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trades.all }),
  })
}

export function useRespondTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; accept: boolean }) =>
      tradesApi.respond(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trades.all }),
  })
}

export function useReviewTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: 'approved' | 'denied'; reviewer_notes?: string }) =>
      tradesApi.review(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trades.all })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
    },
  })
}

export function useBulkReviewTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tradesApi.bulkReview,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trades.all })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
    },
  })
}

export function useCancelTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tradesApi.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trades.all }),
  })
}
