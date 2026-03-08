// frontend/src/hooks/useCallout.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calloutApi, type CalloutEvent, type CalloutListEntry } from '@/api/callout'
import { otApi, type CalloutStep } from '@/api/ot'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useCalloutEvents(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.callout.eventsList(params),
    queryFn: () => calloutApi.listEvents(params),
  })
}

export function useCalloutList(eventId: string) {
  return useQuery({
    queryKey: queryKeys.callout.list(eventId),
    queryFn: () => calloutApi.getList(eventId),
    enabled: !!eventId,
  })
}

export function useCreateCalloutEvent() {
  return useInvalidatingMutation(calloutApi.createEvent, [
    queryKeys.callout.events,
    queryKeys.otRequests.all,
    queryKeys.nav.badges,
    queryKeys.schedule.dashboard,
  ])
}

export function useRecordAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      eventId,
      ...body
    }: { eventId: string; user_id: string; response: string; notes?: string }) =>
      calloutApi.recordAttempt(eventId, body),
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: queryKeys.callout.events })
      await qc.cancelQueries({ queryKey: queryKeys.callout.list(variables.eventId) })

      // Snapshot callout events and the specific callout queue
      const previousEvents = qc.getQueriesData<CalloutEvent[]>({
        queryKey: queryKeys.callout.events,
      })
      const previousQueue = qc.getQueryData<CalloutListEntry[]>(
        queryKeys.callout.list(variables.eventId),
      )

      // If the response is 'accepted', optimistically mark the event as filled
      if (variables.response === 'accepted') {
        qc.setQueriesData<CalloutEvent[]>(
          { queryKey: queryKeys.callout.events },
          (old) => {
            if (!old || !Array.isArray(old)) return old
            return old.map((event: CalloutEvent) =>
              event.id === variables.eventId
                ? {
                    ...event,
                    status: 'filled' as const,
                    assigned_user_id: variables.user_id,
                    updated_at: new Date().toISOString(),
                  }
                : event,
            )
          },
        )
      }

      // Optimistically mark the user as unavailable in the queue
      if (previousQueue) {
        qc.setQueryData<CalloutListEntry[]>(
          queryKeys.callout.list(variables.eventId),
          previousQueue.map((entry: CalloutListEntry) =>
            entry.user_id === variables.user_id
              ? {
                  ...entry,
                  is_available: false,
                  unavailable_reason: variables.response === 'accepted'
                    ? 'Accepted'
                    : variables.response,
                }
              : entry,
          ),
        )
      }

      return { previousEvents, previousQueue }
    },
    onError: (_err, vars, context) => {
      if (context?.previousEvents) {
        for (const [key, data] of context.previousEvents) {
          qc.setQueryData(key, data)
        }
      }
      if (context?.previousQueue) {
        qc.setQueryData(queryKeys.callout.list(vars.eventId), context.previousQueue)
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.events })
      qc.invalidateQueries({ queryKey: queryKeys.callout.list(vars.eventId) })
      qc.invalidateQueries({ queryKey: queryKeys.otRequests.all })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
      qc.invalidateQueries({ queryKey: queryKeys.ot.queueAll })
      qc.invalidateQueries({ queryKey: queryKeys.ot.hoursAll })
      qc.invalidateQueries({ queryKey: queryKeys.nav.badges })
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.all })
    },
  })
}

export function useCancelCalloutEvent() {
  return useInvalidatingMutation(calloutApi.cancelEvent, [
    queryKeys.callout.events,
    queryKeys.callout.listAll,
    queryKeys.nav.badges,
    queryKeys.schedule.dashboard,
  ])
}

export function useCancelCalloutOtAssignment() {
  return useInvalidatingMutation(calloutApi.cancelOtAssignment, [
    queryKeys.callout.events,
    queryKeys.schedule.all,
    queryKeys.ot.queueAll,
    queryKeys.ot.hoursAll,
    queryKeys.coveragePlans.all,
    queryKeys.staffing.all,
  ])
}

export function useCalloutVolunteers(eventId: string) {
  return useQuery({
    queryKey: queryKeys.callout.volunteers(eventId),
    queryFn: () => otApi.listVolunteers(eventId),
    enabled: !!eventId,
  })
}

export function useAdvanceCalloutStep() {
  return useInvalidatingMutation(
    ({ eventId, step }: { eventId: string; step: CalloutStep }) =>
      otApi.advanceStep(eventId, step),
    [queryKeys.callout.events],
  )
}

// -- Bump Requests --

export function useBumpRequests(eventId: string) {
  return useQuery({
    queryKey: queryKeys.callout.bumpRequests(eventId),
    queryFn: () => calloutApi.listBumpRequests(eventId),
    enabled: !!eventId,
  })
}

export function useCreateBumpRequest() {
  return useInvalidatingMutation(
    ({ eventId, ...payload }: { eventId: string; displaced_user_id: string; reason?: string }) =>
      calloutApi.createBumpRequest(eventId, payload),
    [queryKeys.callout.bumpRequestsAll, queryKeys.callout.events],
  )
}

export function useReviewBumpRequest() {
  return useInvalidatingMutation(
    ({ requestId, ...payload }: { requestId: string; approved: boolean; reason?: string }) =>
      calloutApi.reviewBumpRequest(requestId, payload),
    [queryKeys.callout.bumpRequestsAll, queryKeys.callout.events],
  )
}
