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
import { otApi } from '@/api/ot'
import type { CalloutStep } from '@/api/ot'
import { leaveBalancesApi } from '@/api/leaveBalances'
import { coverageApi } from '@/api/coverage'
import { tradesApi, type TradeListParams } from '@/api/trades'
import { vacationBidsApi } from '@/api/vacationBids'
import { biddingApi } from '@/api/bidding'
import { employeeApi, type UpdatePreferencesRequest } from '@/api/employee'
import { holidaysApi } from '@/api/holidays'
import { reportsApi } from '@/api/reports'
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
    list: (params?: { include_inactive?: boolean; limit?: number; offset?: number }) =>
      ['users', params] as const,
    detail: (id: string) => ['users', id] as const,
  },
  organization: {
    current: ['organization'] as const,
  },
  schedule: {
    staffing: (start: string, end: string, teamId?: string) =>
      ['schedule', 'staffing', start, end, teamId] as const,
    grid: (start: string, end: string, teamId?: string) =>
      ['schedule', 'grid', start, end, teamId] as const,
    day: (date: string) => ['schedule', 'day', date] as const,
    dashboard: ['schedule', 'dashboard'] as const,
    annotations: (start: string, end: string) =>
      ['schedule', 'annotations', start, end] as const,
  },
  coverage: {
    all: ['coverage'] as const,
    list: (params?: { shift_template_id?: string; classification_id?: string }) =>
      ['coverage', params] as const,
  },
  periods: {
    all: ['schedule-periods'] as const,
    assignments: (periodId: string) => ['schedule-periods', periodId, 'assignments'] as const,
  },
  shifts: {
    templates: ['shift-templates'] as const,
    scheduled: (params?: { start_date?: string; end_date?: string }) =>
      ['scheduled-shifts', params] as const,
  },
  leave: {
    types: ['leave-types'] as const,
    all: ['leave'] as const,
    list: (params?: { limit?: number; offset?: number }) => ['leave', params] as const,
    balances: (userId?: string) => ['leave-balances', userId] as const,
    balanceHistory: (userId: string, params?: Record<string, unknown>) =>
      ['leave-balance-history', userId, params] as const,
  },
  accrualSchedules: {
    all: ['accrual-schedules'] as const,
  },
  callout: {
    events: ['callout-events'] as const,
    eventsList: (params?: { limit?: number; offset?: number }) => ['callout-events', params] as const,
    list: (eventId: string) => ['callout-list', eventId] as const,
    volunteers: (eventId: string) => ['callout-volunteers', eventId] as const,
  },
  ot: {
    queue: (classificationId: string, fiscalYear?: number) =>
      ['ot-queue', classificationId, fiscalYear] as const,
    hours: (params?: { user_id?: string; fiscal_year?: number; classification_id?: string }) =>
      ['ot-hours', params] as const,
  },
  trades: {
    all: ['trades'] as const,
    list: (params?: TradeListParams) => ['trades', params] as const,
    detail: (id: string) => ['trades', id] as const,
  },
  vacationBids: {
    all: ['vacation-bids'] as const,
    periods: (year?: number) => ['vacation-bids', 'periods', year] as const,
    windows: (periodId: string) => ['vacation-bids', 'windows', periodId] as const,
    window: (windowId: string) => ['vacation-bids', 'window', windowId] as const,
  },
  bidding: {
    windows: (periodId: string) => ['bidding', 'windows', periodId] as const,
    window: (windowId: string) => ['bidding', 'window', windowId] as const,
  },
  employee: {
    preferences: ['employee', 'preferences'] as const,
    schedule: (start: string, end: string) => ['employee', 'schedule', start, end] as const,
    dashboard: ['employee', 'dashboard'] as const,
  },
  holidays: {
    all: ['holidays'] as const,
    list: (year?: number) => ['holidays', year] as const,
  },
  reports: {
    coverage: (params: { start_date: string; end_date: string; team_id?: string }) =>
      ['reports', 'coverage', params] as const,
    otSummary: (params?: { fiscal_year?: number; classification_id?: string }) =>
      ['reports', 'ot-summary', params] as const,
    leaveSummary: (params: { start_date: string; end_date: string }) =>
      ['reports', 'leave-summary', params] as const,
  },
  orgSettings: {
    all: ['org-settings'] as const,
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
    mutationFn: ({ id, ...body }: { id: string; name?: string; supervisor_id?: string | null; is_active?: boolean }) =>
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
    mutationFn: ({ slotId, shift_template_id, classification_id, days_of_week, label, is_active }: {
      slotId: string
      teamId: string
      shift_template_id?: string
      classification_id?: string
      days_of_week?: number[]
      label?: string
      is_active?: boolean
    }) => teamsApi.updateSlot(slotId, { shift_template_id, classification_id, days_of_week, label, is_active }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.teams.slots(vars.teamId) })
      qc.invalidateQueries({ queryKey: queryKeys.teams.detail(vars.teamId) })
      qc.invalidateQueries({ queryKey: queryKeys.teams.all })
    },
  })
}

// -- Users --

export function useUsers(params?: { include_inactive?: boolean; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersApi.list(params),
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
  const qc2 = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.deleteAssignment,
    onSuccess: () => qc2.invalidateQueries({ queryKey: ['schedule'] }),
  })
}

// -- Schedule Views --

export function useScheduleGrid(startDate: string, endDate: string, teamId?: string) {
  return useQuery({
    queryKey: queryKeys.schedule.grid(startDate, endDate, teamId),
    queryFn: () => scheduleApi.getGrid(startDate, endDate, teamId),
    enabled: !!startDate && !!endDate,
  })
}

export function useDayView(date: string) {
  return useQuery({
    queryKey: queryKeys.schedule.day(date),
    queryFn: () => scheduleApi.getDayView(date),
    enabled: !!date,
  })
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.schedule.dashboard,
    queryFn: scheduleApi.getDashboard,
  })
}

export function useAnnotations(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.schedule.annotations(startDate, endDate),
    queryFn: () => scheduleApi.listAnnotations(startDate, endDate),
    enabled: !!startDate && !!endDate,
  })
}

export function useCreateAnnotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.createAnnotation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', 'annotations'] })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.dashboard })
    },
  })
}

export function useDeleteAnnotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.deleteAnnotation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', 'annotations'] })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.dashboard })
    },
  })
}

// -- Coverage Requirements --

export function useCoverageRequirements(params?: { shift_template_id?: string; classification_id?: string }) {
  return useQuery({
    queryKey: queryKeys.coverage.list(params),
    queryFn: () => coverageApi.list(params),
  })
}

export function useCreateCoverageRequirement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coverageApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coverage.all }),
  })
}

export function useUpdateCoverageRequirement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; min_headcount?: number; target_headcount?: number; max_headcount?: number }) =>
      coverageApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coverage.all }),
  })
}

export function useDeleteCoverageRequirement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coverageApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coverage.all }),
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

export function useSlotAssignments(periodId: string) {
  return useQuery({
    queryKey: queryKeys.periods.assignments(periodId),
    queryFn: () => schedulePeriodsApi.listAssignments(periodId),
    enabled: !!periodId,
  })
}

export function useAssignSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ periodId, ...body }: { periodId: string; slot_id: string; user_id: string }) =>
      schedulePeriodsApi.assignSlot(periodId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.periods.assignments(vars.periodId) })
    },
  })
}

export function useRemoveSlotAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ periodId, slotId }: { periodId: string; slotId: string }) =>
      schedulePeriodsApi.removeAssignment(periodId, slotId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.periods.assignments(vars.periodId) })
    },
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

export function useLeaveRequests(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.leave.list(params),
    queryFn: () => leaveApi.list(params),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leave.all })
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
    },
  })
}

export function useBulkReviewLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveApi.bulkReview,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leave.all })
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
    },
  })
}

export function useCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leaveApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leave.all })
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
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
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
      qc.invalidateQueries({ queryKey: ['leave-balance-history'] })
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

// -- Callout --

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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: calloutApi.createEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.callout.events }),
  })
}

export function useRecordAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      eventId,
      ...body
    }: { eventId: string; user_id: string; response: string; notes?: string }) =>
      calloutApi.recordAttempt(eventId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.events })
      qc.invalidateQueries({ queryKey: queryKeys.callout.list(vars.eventId) })
    },
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

// -- OT Queue & Hours --

export function useOtQueue(classificationId: string, fiscalYear?: number) {
  return useQuery({
    queryKey: queryKeys.ot.queue(classificationId, fiscalYear),
    queryFn: () => otApi.getQueue(classificationId, fiscalYear),
    enabled: !!classificationId,
  })
}

export function useReorderOtQueue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: otApi.reorderQueue,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ot-queue'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ot-hours'] }),
  })
}

export function useVolunteer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: otApi.volunteer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['callout-volunteers'] })
    },
  })
}

export function useCalloutVolunteers(eventId: string) {
  return useQuery({
    queryKey: queryKeys.callout.volunteers(eventId),
    queryFn: () => otApi.listVolunteers(eventId),
    enabled: !!eventId,
  })
}

export function useAdvanceCalloutStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, step }: { eventId: string; step: CalloutStep }) =>
      otApi.advanceStep(eventId, step),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.events })
    },
  })
}

// -- Trades --

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
    mutationFn: ({ id, ...body }: { id: string; approve: boolean; reviewer_notes?: string }) =>
      tradesApi.review(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trades.all })
      qc.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}

export function useBulkReviewTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tradesApi.bulkReview,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trades.all })
      qc.invalidateQueries({ queryKey: ['schedule'] })
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

// -- Vacation Bids --

export function useVacationBidPeriods(year?: number) {
  return useQuery({
    queryKey: queryKeys.vacationBids.periods(year),
    queryFn: () => vacationBidsApi.listPeriods(year),
  })
}

export function useVacationBidWindows(periodId: string) {
  return useQuery({
    queryKey: queryKeys.vacationBids.windows(periodId),
    queryFn: () => vacationBidsApi.listWindows(periodId),
    enabled: !!periodId,
  })
}

export function useVacationBidWindow(windowId: string) {
  return useQuery({
    queryKey: queryKeys.vacationBids.window(windowId),
    queryFn: () => vacationBidsApi.getWindow(windowId),
    enabled: !!windowId,
  })
}

export function useCreateVacationBidPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vacationBidsApi.createPeriod,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vacationBids.all }),
  })
}

export function useDeleteVacationBidPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vacationBidsApi.deletePeriod,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vacationBids.all }),
  })
}

export function useOpenVacationBidding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; window_duration_hours: number; start_at?: string }) =>
      vacationBidsApi.openBidding(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vacationBids.all }),
  })
}

export function useSubmitVacationBid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ windowId, picks }: { windowId: string; picks: { start_date: string; end_date: string; preference_rank: number }[] }) =>
      vacationBidsApi.submitBid(windowId, { picks }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.vacationBids.window(vars.windowId) })
      qc.invalidateQueries({ queryKey: queryKeys.vacationBids.all })
    },
  })
}

export function useProcessVacationBids() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vacationBidsApi.processBids,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vacationBids.all })
      qc.invalidateQueries({ queryKey: queryKeys.leave.all })
    },
  })
}

// -- Shift Bidding --

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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ periodId, ...body }: { periodId: string; window_duration_hours: number; start_at?: string }) =>
      biddingApi.openBidding(periodId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.periods.all })
      qc.invalidateQueries({ queryKey: queryKeys.bidding.windows(vars.periodId) })
    },
  })
}

export function useSubmitBid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ windowId, preferences }: { windowId: string; preferences: { slot_id: string; preference_rank: number }[] }) =>
      biddingApi.submitBid(windowId, { preferences }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.bidding.window(vars.windowId) })
    },
  })
}

export function useProcessBids() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: biddingApi.processBids,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.periods.all })
      qc.invalidateQueries({ queryKey: ['bidding'] })
      qc.invalidateQueries({ queryKey: ['schedule-periods'] })
    },
  })
}

// -- Employee Portal --

export function useMyPreferences() {
  return useQuery({
    queryKey: queryKeys.employee.preferences,
    queryFn: employeeApi.getPreferences,
  })
}

export function useUpdateMyPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdatePreferencesRequest) => employeeApi.updatePreferences(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employee.preferences }),
  })
}

export function useMySchedule(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.employee.schedule(startDate, endDate),
    queryFn: () => employeeApi.getSchedule(startDate, endDate),
    enabled: !!startDate && !!endDate,
  })
}

export function useMyDashboard() {
  return useQuery({
    queryKey: queryKeys.employee.dashboard,
    queryFn: employeeApi.getDashboard,
  })
}

// -- Holidays --

export function useHolidays(year?: number) {
  return useQuery({
    queryKey: queryKeys.holidays.list(year),
    queryFn: () => holidaysApi.list(year),
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: holidaysApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.holidays.all }),
  })
}

export function useUpdateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; is_premium_pay?: boolean }) =>
      holidaysApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.holidays.all }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: holidaysApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.holidays.all }),
  })
}

// -- Reports --

export function useCoverageReport(params: { start_date: string; end_date: string; team_id?: string }) {
  return useQuery({
    queryKey: queryKeys.reports.coverage(params),
    queryFn: () => reportsApi.coverage(params),
    enabled: !!params.start_date && !!params.end_date,
  })
}

export function useOtSummaryReport(params?: { fiscal_year?: number; classification_id?: string }) {
  return useQuery({
    queryKey: queryKeys.reports.otSummary(params),
    queryFn: () => reportsApi.otSummary(params),
  })
}

export function useLeaveSummaryReport(params: { start_date: string; end_date: string }) {
  return useQuery({
    queryKey: queryKeys.reports.leaveSummary(params),
    queryFn: () => reportsApi.leaveSummary(params),
    enabled: !!params.start_date && !!params.end_date,
  })
}

// -- Org Settings --

export function useOrgSettings() {
  return useQuery({
    queryKey: queryKeys.orgSettings.all,
    queryFn: organizationApi.listSettings,
  })
}

export function useSetOrgSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: organizationApi.setSetting,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orgSettings.all }),
  })
}
