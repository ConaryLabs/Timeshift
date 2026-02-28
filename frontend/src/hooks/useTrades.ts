import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tradesApi, type TradeListParams, type TradeRequest } from '@/api/trades'
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: 'approved' | 'denied'; reviewer_notes?: string }) =>
      tradesApi.review(id, body),
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: queryKeys.trades.all })

      // Snapshot all trade list queries and detail queries
      const previousLists = qc.getQueriesData<TradeRequest[]>({
        queryKey: queryKeys.trades.all,
      })

      // Optimistically update the trade status in all cached lists
      qc.setQueriesData<TradeRequest[]>(
        { queryKey: queryKeys.trades.all },
        (old) => {
          if (!old || !Array.isArray(old)) return old
          return old.map((trade: TradeRequest) =>
            trade.id === variables.id
              ? {
                  ...trade,
                  status: variables.status,
                  reviewer_notes: variables.reviewer_notes ?? trade.reviewer_notes,
                  updated_at: new Date().toISOString(),
                }
              : trade,
          )
        },
      )

      return { previousLists }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trades.all })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
      qc.invalidateQueries({ queryKey: queryKeys.nav.badges })
    },
  })
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
