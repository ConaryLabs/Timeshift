import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leaveApi } from '@/api/leave'
import { leaveBalancesApi } from '@/api/leaveBalances'
import { leaveSellbackApi } from '@/api/leaveSellback'
import { sickDonationApi } from '@/api/sickDonation'
import { queryKeys } from './queryKeys'

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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leave.all })
      qc.invalidateQueries({ queryKey: queryKeys.nav.badges })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.dashboard })
    },
  })
}

export function useReviewLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: 'approved' | 'denied'; reviewer_notes?: string }) =>
      leaveApi.review(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leave.all })
      qc.invalidateQueries({ queryKey: queryKeys.leave.balancesAll })
      qc.invalidateQueries({ queryKey: queryKeys.nav.badges })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
    },
  })
}

export function useBulkReviewLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveApi.bulkReview,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leave.all })
      qc.invalidateQueries({ queryKey: queryKeys.leave.balancesAll })
      qc.invalidateQueries({ queryKey: queryKeys.nav.badges })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
    },
  })
}

export function useCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leave.all })
      qc.invalidateQueries({ queryKey: queryKeys.leave.balancesAll })
      qc.invalidateQueries({ queryKey: queryKeys.nav.badges })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.dashboard })
    },
  })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveBalancesApi.adjust,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leave.balancesAll })
      qc.invalidateQueries({ queryKey: queryKeys.leave.balanceHistoryAll })
    },
  })
}

export function useAccrualSchedules() {
  return useQuery({
    queryKey: queryKeys.accrualSchedules.all,
    queryFn: leaveBalancesApi.listAccrualSchedules,
  })
}

export function useCreateAccrualSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveBalancesApi.createAccrualSchedule,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.accrualSchedules.all }),
  })
}

export function useUpdateAccrualSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; hours_per_pay_period?: number; max_balance_hours?: number | null; years_of_service_min?: number; years_of_service_max?: number | null }) =>
      leaveBalancesApi.updateAccrualSchedule(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.accrualSchedules.all }),
  })
}

export function useDeleteAccrualSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveBalancesApi.deleteAccrualSchedule,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.accrualSchedules.all }),
  })
}

// -- Leave Sellback --

export function useSellbackRequests() {
  return useQuery({
    queryKey: queryKeys.sellback.all,
    queryFn: leaveSellbackApi.list,
  })
}

export function useCreateSellback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveSellbackApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sellback.all })
      qc.invalidateQueries({ queryKey: queryKeys.leave.balancesAll })
    },
  })
}

export function useReviewSellback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: string; reviewer_notes?: string }) =>
      leaveSellbackApi.review(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sellback.all })
      qc.invalidateQueries({ queryKey: queryKeys.leave.balancesAll })
    },
  })
}

export function useCancelSellback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveSellbackApi.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sellback.all }),
  })
}

// -- Sick Leave Donations --

export function useDonations() {
  return useQuery({
    queryKey: queryKeys.donation.all,
    queryFn: sickDonationApi.list,
  })
}

export function useCreateDonation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sickDonationApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.donation.all })
      qc.invalidateQueries({ queryKey: queryKeys.leave.balancesAll })
    },
  })
}

export function useReviewDonation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: string; reviewer_notes?: string }) =>
      sickDonationApi.review(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.donation.all })
      qc.invalidateQueries({ queryKey: queryKeys.leave.balancesAll })
    },
  })
}

export function useCancelDonation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sickDonationApi.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.donation.all }),
  })
}
