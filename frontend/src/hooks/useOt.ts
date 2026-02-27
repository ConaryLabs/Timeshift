import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { otApi } from '@/api/ot'
import { otRequestsApi, type OtRequestListParams } from '@/api/otRequests'
import { queryKeys } from './queryKeys'

// -- OT Queue & Hours --

export function useOtQueue(classificationId: string, fiscalYear?: number) {
  return useQuery({
    queryKey: queryKeys.ot.queue(classificationId, fiscalYear),
    queryFn: () => otApi.getQueue(classificationId, fiscalYear),
    enabled: !!classificationId,
  })
}

export function useSetOtQueuePosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: otApi.setQueuePosition,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ot.queueAll }),
  })
}

export function useOtHours(params?: { user_id?: string; fiscal_year?: number; classification_id?: string }) {
  return useQuery({
    queryKey: queryKeys.ot.hours(params),
    queryFn: () => otApi.getHours(params),
  })
}

export function useAdjustOtHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: otApi.adjustHours,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ot.hoursAll }),
  })
}

export function useVolunteer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: otApi.volunteer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.volunteersAll })
      qc.invalidateQueries({ queryKey: queryKeys.callout.events })
      qc.invalidateQueries({ queryKey: queryKeys.otRequests.all })
    },
  })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: otRequestsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.otRequests.all })
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.all })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
      qc.invalidateQueries({ queryKey: ['staffing'] })
    },
  })
}

export function useVolunteerOtRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: otRequestsApi.volunteer,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.otRequests.all }),
  })
}

export function useWithdrawVolunteerOtRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: otRequestsApi.withdrawVolunteer,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.otRequests.all }),
  })
}

export function useAssignOtRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; user_id: string; ot_type?: 'voluntary' | 'mandatory' | 'mandatory_day_off' | 'fixed_coverage'; force?: boolean }) =>
      otRequestsApi.assign(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.otRequests.all })
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.all })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
      qc.invalidateQueries({ queryKey: ['staffing'] })
    },
  })
}

export function useUpdateOtRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; notes?: string; location?: string; status?: string; expected_updated_at?: string }) =>
      otRequestsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.otRequests.all }),
  })
}

export function useCancelOtRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: otRequestsApi.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.otRequests.all }),
  })
}

export function useCancelOtAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      otRequestsApi.cancelAssignment(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.otRequests.all }),
  })
}
