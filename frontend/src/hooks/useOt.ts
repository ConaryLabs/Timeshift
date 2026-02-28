import { useQuery } from '@tanstack/react-query'
import { otApi } from '@/api/ot'
import { otRequestsApi, type OtRequestListParams } from '@/api/otRequests'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

// -- OT Queue & Hours --

export function useOtQueue(classificationId: string, fiscalYear?: number) {
  return useQuery({
    queryKey: queryKeys.ot.queue(classificationId, fiscalYear),
    queryFn: () => otApi.getQueue(classificationId, fiscalYear),
    enabled: !!classificationId,
  })
}

export function useSetOtQueuePosition() {
  return useInvalidatingMutation(otApi.setQueuePosition, [queryKeys.ot.queueAll])
}

export function useOtHours(params?: { user_id?: string; fiscal_year?: number; classification_id?: string }) {
  return useQuery({
    queryKey: queryKeys.ot.hours(params),
    queryFn: () => otApi.getHours(params),
  })
}

export function useAdjustOtHours() {
  return useInvalidatingMutation(otApi.adjustHours, [queryKeys.ot.hoursAll])
}

export function useVolunteer() {
  return useInvalidatingMutation(otApi.volunteer, [
    queryKeys.callout.volunteersAll,
    queryKeys.callout.events,
    queryKeys.otRequests.all,
  ])
}

// -- OT Requests --

export function useOtRequests(params?: OtRequestListParams) {
  return useQuery({
    queryKey: queryKeys.otRequests.list(params),
    queryFn: () => otRequestsApi.list(params),
  })
}

export function useOtRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.otRequests.detail(id),
    queryFn: () => otRequestsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateOtRequest() {
  return useInvalidatingMutation(otRequestsApi.create, [
    queryKeys.otRequests.all,
    queryKeys.coveragePlans.all,
    queryKeys.schedule.all,
    queryKeys.staffing.all,
  ])
}

export function useVolunteerOtRequest() {
  return useInvalidatingMutation(otRequestsApi.volunteer, [queryKeys.otRequests.all])
}

export function useWithdrawVolunteerOtRequest() {
  return useInvalidatingMutation(otRequestsApi.withdrawVolunteer, [queryKeys.otRequests.all])
}

export function useAssignOtRequest() {
  return useInvalidatingMutation(
    ({ id, ...data }: { id: string; user_id: string; ot_type?: 'voluntary' | 'mandatory' | 'mandatory_day_off' | 'fixed_coverage'; force?: boolean }) =>
      otRequestsApi.assign(id, data),
    [
      queryKeys.otRequests.all,
      queryKeys.coveragePlans.all,
      queryKeys.schedule.all,
      queryKeys.staffing.all,
    ],
  )
}

export function useUpdateOtRequest() {
  return useInvalidatingMutation(
    ({ id, ...data }: { id: string; notes?: string; location?: string; status?: string; expected_updated_at?: string }) =>
      otRequestsApi.update(id, data),
    [queryKeys.otRequests.all],
  )
}

export function useCancelOtRequest() {
  return useInvalidatingMutation(otRequestsApi.cancel, [
    queryKeys.otRequests.all,
    queryKeys.schedule.all,
    queryKeys.coveragePlans.all,
    queryKeys.staffing.all,
  ])
}

export function useCancelOtAssignment() {
  return useInvalidatingMutation(
    ({ id, userId }: { id: string; userId: string }) =>
      otRequestsApi.cancelAssignment(id, userId),
    [
      queryKeys.otRequests.all,
      queryKeys.schedule.all,
      queryKeys.coveragePlans.all,
      queryKeys.staffing.all,
    ],
  )
}
