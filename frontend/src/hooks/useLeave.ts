// frontend/src/hooks/useLeave.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leaveApi, type LeaveRequest } from '@/api/leave'
import { leaveBalancesApi } from '@/api/leaveBalances'
import { leaveSellbackApi } from '@/api/leaveSellback'
import { sickDonationApi } from '@/api/sickDonation'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

// -- Leave --

export function useLeaveTypes() {
  return useQuery({
    queryKey: queryKeys.leave.types,
    queryFn: leaveApi.listTypes,
  })
}

export function useLeaveRequests(params?: { limit?: number; offset?: number; status?: string }) {
  return useQuery({
    queryKey: queryKeys.leave.list(params),
    queryFn: () => leaveApi.list(params),
  })
}

export function useCreateLeave() {
  return useInvalidatingMutation(leaveApi.create, [
    queryKeys.leave.all,
    queryKeys.nav.badges,
    queryKeys.schedule.dashboard,
  ])
}

export function useReviewLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: 'approved' | 'denied'; reviewer_notes?: string }) =>
      leaveApi.review(id, body),
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: queryKeys.leave.all })

      // Snapshot all leave list queries
      const previousLists = qc.getQueriesData<LeaveRequest[]>({
        queryKey: queryKeys.leave.all,
      })

      // Optimistically update the leave request status in all cached lists
      qc.setQueriesData<LeaveRequest[]>(
        { queryKey: queryKeys.leave.all },
        (old) => {
          if (!old || !Array.isArray(old)) return old
          return old.map((req: LeaveRequest) =>
            req.id === variables.id
              ? {
                  ...req,
                  status: variables.status,
                  reviewer_notes: variables.reviewer_notes ?? req.reviewer_notes,
                  updated_at: new Date().toISOString(),
                }
              : req,
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
      qc.invalidateQueries({ queryKey: queryKeys.leave.all })
      qc.invalidateQueries({ queryKey: queryKeys.leave.balancesAll })
      qc.invalidateQueries({ queryKey: queryKeys.nav.badges })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
    },
  })
}

export function useBulkReviewLeave() {
  return useInvalidatingMutation(leaveApi.bulkReview, [
    queryKeys.leave.all,
    queryKeys.leave.balancesAll,
    queryKeys.nav.badges,
    queryKeys.schedule.all,
  ])
}

export function useCancelLeave() {
  return useInvalidatingMutation(leaveApi.cancel, [
    queryKeys.leave.all,
    queryKeys.leave.balancesAll,
    queryKeys.nav.badges,
    queryKeys.schedule.dashboard,
  ])
}

// -- Leave Balances --

export function useLeaveBalances(userId?: string) {
  return useQuery({
    queryKey: queryKeys.leave.balances(userId),
    queryFn: () => leaveBalancesApi.list(userId),
  })
}

export function useLeaveBalanceHistory(
  userId: string,
  params?: { leave_type_id?: string; start_date?: string; end_date?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: queryKeys.leave.balanceHistory(userId, params),
    queryFn: () => leaveBalancesApi.history(userId, params),
    enabled: !!userId,
  })
}

export function useAdjustLeaveBalance() {
  return useInvalidatingMutation(leaveBalancesApi.adjust, [
    queryKeys.leave.balancesAll,
    queryKeys.leave.balanceHistoryAll,
  ])
}

export function useAccrualSchedules() {
  return useQuery({
    queryKey: queryKeys.accrualSchedules.all,
    queryFn: leaveBalancesApi.listAccrualSchedules,
  })
}

export function useCreateAccrualSchedule() {
  return useInvalidatingMutation(leaveBalancesApi.createAccrualSchedule, [queryKeys.accrualSchedules.all])
}

export function useUpdateAccrualSchedule() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; hours_per_pay_period?: number; max_balance_hours?: number | null; years_of_service_min?: number; years_of_service_max?: number | null }) =>
      leaveBalancesApi.updateAccrualSchedule(id, body),
    [queryKeys.accrualSchedules.all],
  )
}

export function useDeleteAccrualSchedule() {
  return useInvalidatingMutation(leaveBalancesApi.deleteAccrualSchedule, [queryKeys.accrualSchedules.all])
}

// -- Leave Sellback --

export function useSellbackRequests() {
  return useQuery({
    queryKey: queryKeys.sellback.all,
    queryFn: leaveSellbackApi.list,
  })
}

export function useCreateSellback() {
  return useInvalidatingMutation(leaveSellbackApi.create, [
    queryKeys.sellback.all,
    queryKeys.leave.balancesAll,
  ])
}

export function useReviewSellback() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; status: string; reviewer_notes?: string }) =>
      leaveSellbackApi.review(id, body),
    [queryKeys.sellback.all, queryKeys.leave.balancesAll],
  )
}

export function useCancelSellback() {
  return useInvalidatingMutation(leaveSellbackApi.cancel, [queryKeys.sellback.all])
}

// -- Sick Leave Donations --

export function useDonations() {
  return useQuery({
    queryKey: queryKeys.donation.all,
    queryFn: sickDonationApi.list,
  })
}

export function useCreateDonation() {
  return useInvalidatingMutation(sickDonationApi.create, [
    queryKeys.donation.all,
    queryKeys.leave.balancesAll,
  ])
}

export function useReviewDonation() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; status: string; reviewer_notes?: string }) =>
      sickDonationApi.review(id, body),
    [queryKeys.donation.all, queryKeys.leave.balancesAll],
  )
}

export function useCancelDonation() {
  return useInvalidatingMutation(sickDonationApi.cancel, [queryKeys.donation.all])
}
