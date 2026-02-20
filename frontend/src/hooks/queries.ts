import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { classificationsApi } from '@/api/classifications'
import { teamsApi } from '@/api/teams'
import { usersApi } from '@/api/users'
import { organizationApi } from '@/api/organization'
import { scheduleApi } from '@/api/schedule'
import { schedulePeriodsApi } from '@/api/schedulePeriods'
import { shiftsApi } from '@/api/shifts'
import { leaveApi } from '@/api/leave'
import { calloutApi } from '@/api/callout'
import { useAuthStore } from '@/store/auth'

// -- Query key factories --

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  classifications: {
    all: ['classifications'] as const,
  },
  teams: {
    all: ['teams'] as const,
    detail: (id: string) => ['teams', id] as const,
    slots: (teamId: string) => ['teams', teamId, 'slots'] as const,
  },
  users: {
    all: ['users'] as const,
    detail: (id: string) => ['users', id] as const,
  },
  organization: {
    current: ['organization'] as const,
  },
  schedule: {
    staffing: (start: string, end: string, teamId?: string) =>
      ['schedule', 'staffing', start, end, teamId] as const,
  },
  periods: {
    all: ['schedule-periods'] as const,
  },
  shifts: {
    templates: ['shift-templates'] as const,
    scheduled: (params?: { start_date?: string; end_date?: string }) =>
      ['scheduled-shifts', params] as const,
  },
  leave: {
    types: ['leave-types'] as const,
    all: ['leave'] as const,
  },
  callout: {
    events: ['callout-events'] as const,
    list: (eventId: string) => ['callout-list', eventId] as const,
  },
} as const

// -- Auth --

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser)
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const profile = await authApi.me()
      setUser(profile)
      return profile
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

// -- Classifications --

export function useClassifications() {
  return useQuery({
    queryKey: queryKeys.classifications.all,
    queryFn: classificationsApi.list,
  })
}

export function useCreateClassification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: classificationsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classifications.all }),
  })
}

export function useUpdateClassification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; abbreviation?: string; display_order?: number; is_active?: boolean }) =>
      classificationsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classifications.all }),
  })
}

// -- Teams --

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams.all,
    queryFn: teamsApi.list,
  })
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: queryKeys.teams.detail(id),
    queryFn: () => teamsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.teams.all }),
  })
}

export function useUpdateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; supervisor_id?: string; is_active?: boolean }) =>
      teamsApi.update(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.teams.all })
      qc.invalidateQueries({ queryKey: queryKeys.teams.detail(vars.id) })
    },
  })
}

export function useTeamSlots(teamId: string) {
  return useQuery({
    queryKey: queryKeys.teams.slots(teamId),
    queryFn: () => teamsApi.listSlots(teamId),
    enabled: !!teamId,
  })
}

export function useCreateSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, ...body }: {
      teamId: string
      shift_template_id: string
      classification_id: string
      days_of_week: number[]
      label?: string
    }) => teamsApi.createSlot(teamId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.teams.slots(vars.teamId) })
      qc.invalidateQueries({ queryKey: queryKeys.teams.detail(vars.teamId) })
      qc.invalidateQueries({ queryKey: queryKeys.teams.all })
    },
  })
}

export function useUpdateSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slotId, ...body }: {
      slotId: string
      shift_template_id?: string
      classification_id?: string
      days_of_week?: number[]
      label?: string
      is_active?: boolean
    }) => teamsApi.updateSlot(slotId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

// -- Users --

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: usersApi.list,
  })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => usersApi.get(id),
    enabled: !!id,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Parameters<typeof usersApi.update>[1] & { id: string }) =>
      usersApi.update(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all })
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(vars.id) })
    },
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  })
}

// -- Organization --

export function useOrganization() {
  return useQuery({
    queryKey: queryKeys.organization.current,
    queryFn: organizationApi.get,
  })
}

export function useUpdateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: organizationApi.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.organization.current }),
  })
}

// -- Schedule --

export function useStaffing(startDate: string, endDate: string, teamId?: string) {
  return useQuery({
    queryKey: queryKeys.schedule.staffing(startDate, endDate, teamId),
    queryFn: () => scheduleApi.getStaffing(startDate, endDate, teamId),
    enabled: !!startDate && !!endDate,
  })
}

export function useCreateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.createAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  })
}

export function useDeleteAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.deleteAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  })
}

// -- Schedule Periods --

export function useSchedulePeriods() {
  return useQuery({
    queryKey: queryKeys.periods.all,
    queryFn: schedulePeriodsApi.list,
  })
}

export function useCreatePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: schedulePeriodsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.periods.all }),
  })
}

export function useAssignSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ periodId, ...body }: { periodId: string; slot_id: string; user_id: string }) =>
      schedulePeriodsApi.assignSlot(periodId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.periods.all }),
  })
}

// -- Shift Templates --

export function useShiftTemplates() {
  return useQuery({
    queryKey: queryKeys.shifts.templates,
    queryFn: scheduleApi.getTemplates,
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.createTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shifts.templates }),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; color?: string; is_active?: boolean }) =>
      scheduleApi.updateTemplate(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shifts.templates }),
  })
}

// -- Scheduled Shifts --

export function useScheduledShifts(params?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: queryKeys.shifts.scheduled(params),
    queryFn: () => shiftsApi.listScheduled(params),
  })
}

// -- Leave --

export function useLeaveTypes() {
  return useQuery({
    queryKey: queryKeys.leave.types,
    queryFn: leaveApi.listTypes,
  })
}

export function useLeaveRequests() {
  return useQuery({
    queryKey: queryKeys.leave.all,
    queryFn: leaveApi.list,
  })
}

export function useCreateLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.leave.all }),
  })
}

export function useReviewLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: 'approved' | 'denied'; reviewer_notes?: string }) =>
      leaveApi.review(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.leave.all }),
  })
}

export function useCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveApi.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.leave.all }),
  })
}

// -- Callout --

export function useCalloutEvents() {
  return useQuery({
    queryKey: queryKeys.callout.events,
    queryFn: calloutApi.listEvents,
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: calloutApi.createEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.callout.events }),
  })
}

export function useCancelCalloutEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: calloutApi.cancelEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.events })
      qc.invalidateQueries({ queryKey: ['callout-list'] })
    },
  })
}
