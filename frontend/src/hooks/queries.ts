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
import { tradesApi, type TradeListParams } from '@/api/trades'
import { vacationBidsApi } from '@/api/vacationBids'
import { biddingApi } from '@/api/bidding'
import { employeeApi, type UpdatePreferencesRequest } from '@/api/employee'
import { holidaysApi } from '@/api/holidays'
import { reportsApi } from '@/api/reports'
import { leaveSellbackApi } from '@/api/leaveSellback'
import { sickDonationApi } from '@/api/sickDonation'
import { navApi } from '@/api/nav'
import { otRequestsApi, type OtRequestListParams } from '@/api/otRequests'
import { coveragePlansApi } from '@/api/coveragePlans'
import type { SlotEntry } from '@/api/coveragePlans'
import notificationsApi, { type NotificationListParams } from '@/api/notifications'
import { dutyPositionsApi } from '@/api/dutyPositions'
import { specialAssignmentsApi, type SpecialAssignmentListParams } from '@/api/specialAssignments'
import { savedFiltersApi } from '@/api/savedFilters'
import { shiftPatternsApi } from '@/api/shiftPatterns'
import { bargainingUnitsApi } from '@/api/bargainingUnits'
import { staffingApi } from '@/api/staffing'
import { useAuthStore } from '@/store/auth'

// -- Query key factories --

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  bargainingUnits: {
    all: ['bargainingUnits'] as const,
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
    directory: ['users', 'directory'] as const,
  },
  organization: {
    current: ['organization'] as const,
  },
  schedule: {
    all: ['schedule'] as const,
    staffing: (start: string, end: string, teamId?: string) =>
      ['schedule', 'staffing', start, end, teamId] as const,
    grid: (start: string, end: string, teamId?: string) =>
      ['schedule', 'grid', start, end, teamId] as const,
    day: (date: string) => ['schedule', 'day', date] as const,
    dashboard: ['schedule', 'dashboard'] as const,
    annotations: ['schedule', 'annotations'] as const,
    annotationsRange: (start: string, end: string) =>
      ['schedule', 'annotations', start, end] as const,
  },
  coveragePlans: {
    all: ['coverage-plans'] as const,
    list: ['coverage-plans', 'list'] as const,
    detail: (id: string) => ['coverage-plans', id] as const,
    slots: (planId: string) => ['coverage-plans', planId, 'slots'] as const,
    assignments: ['coverage-plans', 'assignments'] as const,
    resolved: (date: string) => ['coverage-plans', 'resolved', date] as const,
    gaps: (date: string) => ['coverage-plans', 'gaps', date] as const,
    dayGrid: (date: string) => ['coverage-plans', 'day-grid', date] as const,
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
    balancesAll: ['leave-balances'] as const,
    balances: (userId?: string) => ['leave-balances', userId] as const,
    balanceHistoryAll: ['leave-balance-history'] as const,
    balanceHistory: (userId: string, params?: Record<string, unknown>) =>
      ['leave-balance-history', userId, params] as const,
  },
  accrualSchedules: {
    all: ['accrual-schedules'] as const,
  },
  callout: {
    events: ['callout-events'] as const,
    eventsList: (params?: { limit?: number; offset?: number }) => ['callout-events', params] as const,
    listAll: ['callout-list'] as const,
    list: (eventId: string) => ['callout-list', eventId] as const,
    volunteersAll: ['callout-volunteers'] as const,
    volunteers: (eventId: string) => ['callout-volunteers', eventId] as const,
    bumpRequestsAll: ['bump-requests'] as const,
    bumpRequests: (eventId: string) => ['bump-requests', eventId] as const,
  },
  ot: {
    queueAll: ['ot-queue'] as const,
    queue: (classificationId: string, fiscalYear?: number) =>
      ['ot-queue', classificationId, fiscalYear] as const,
    hoursAll: ['ot-hours'] as const,
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
    all: ['bidding'] as const,
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
    otByPeriod: (params: { start_date: string; end_date: string; classification_id?: string }) =>
      ['reports', 'ot-by-period', params] as const,
    workSummary: (params: { start_date: string; end_date: string; user_id?: string }) =>
      ['reports', 'work-summary', params] as const,
  },
  savedFilters: {
    all: ['saved-filters'] as const,
    byPage: (page: string) => ['saved-filters', page] as const,
  },
  shiftPatterns: {
    all: ['shift-patterns'] as const,
    cycle: (id: string, date: string) => ['shift-patterns', id, 'cycle', date] as const,
    assignments: ['shift-pattern-assignments'] as const,
  },
  orgSettings: {
    all: ['org-settings'] as const,
  },
  sellback: {
    all: ['sellback'] as const,
  },
  donation: {
    all: ['donation'] as const,
  },
  otRequests: {
    all: ['ot-requests'] as const,
    list: (params?: OtRequestListParams) => ['ot-requests', params] as const,
    detail: (id: string) => ['ot-requests', id] as const,
  },
  nav: {
    badges: ['nav', 'badges'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (params?: NotificationListParams) => ['notifications', params] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  dutyPositions: {
    all: ['duty-positions'] as const,
    assignments: (date: string, shiftTemplateId?: string) =>
      ['duty-assignments', date, shiftTemplateId] as const,
  },
  specialAssignments: {
    all: ['special-assignments'] as const,
    list: (params?: SpecialAssignmentListParams) => ['special-assignments', params] as const,
    detail: (id: string) => ['special-assignments', id] as const,
  },
  staffing: {
    available: (date: string, shiftTemplateId: string, classificationId?: string) =>
      ['staffing', 'available', date, shiftTemplateId, classificationId] as const,
    blockAvailable: (date: string, classificationId: string, blockStart: string, blockEnd: string) =>
      ['staffing', 'block-available', date, classificationId, blockStart, blockEnd] as const,
    mandatoryOtOrder: (classificationId: string) =>
      ['staffing', 'mandatory-ot-order', classificationId] as const,
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
    staleTime: 60 * 1000,
    retry: false,
  })
}

// -- Bargaining Units --

export function useBargainingUnits() {
  return useQuery({
    queryKey: queryKeys.bargainingUnits.all,
    queryFn: bargainingUnitsApi.list,
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
    mutationFn: ({ id, ...body }: { id: string; name?: string; supervisor_id?: string | null; parent_team_id?: string | null; is_active?: boolean; expected_updated_at?: string }) =>
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

export function useUserDirectory() {
  return useQuery({
    queryKey: queryKeys.users.directory,
    queryFn: () => usersApi.directory(),
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
      qc.invalidateQueries({ queryKey: queryKeys.auth.me })
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

export function useChangePassword() {
  return useMutation({
    mutationFn: usersApi.changePassword,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.schedule.all }),
  })
}

export function useDeleteAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.deleteAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.schedule.all }),
  })
}

// -- Schedule Views --

export function useScheduleGrid(startDate: string, endDate: string, teamId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.schedule.grid(startDate, endDate, teamId),
    queryFn: () => scheduleApi.getGrid(startDate, endDate, teamId),
    enabled: (options?.enabled ?? true) && !!startDate && !!endDate,
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
    queryKey: queryKeys.schedule.annotationsRange(startDate, endDate),
    queryFn: () => scheduleApi.listAnnotations(startDate, endDate),
    enabled: !!startDate && !!endDate,
  })
}

export function useCreateAnnotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.createAnnotation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedule.annotations })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.dashboard })
    },
  })
}

export function useDeleteAnnotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.deleteAnnotation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedule.annotations })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.dashboard })
    },
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

export function useUpdateSchedulePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; start_date?: string; end_date?: string }) =>
      schedulePeriodsApi.update(id, body),
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
    mutationFn: ({ id, ...body }: { id: string; name?: string; color?: string; is_active?: boolean; expected_updated_at?: string }) =>
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
      qc.invalidateQueries({ queryKey: queryKeys.leave.balancesAll })
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.events })
      qc.invalidateQueries({ queryKey: queryKeys.otRequests.all })
    },
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
      qc.invalidateQueries({ queryKey: queryKeys.otRequests.all })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
      qc.invalidateQueries({ queryKey: queryKeys.ot.queueAll })
      qc.invalidateQueries({ queryKey: queryKeys.ot.hoursAll })
    },
  })
}

export function useCancelCalloutEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: calloutApi.cancelEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.events })
      qc.invalidateQueries({ queryKey: queryKeys.callout.listAll })
    },
  })
}

export function useCancelCalloutOtAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: calloutApi.cancelOtAssignment,
    onSuccess: (_data, eventId) => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.events })
      qc.invalidateQueries({ queryKey: queryKeys.callout.list(eventId) })
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all })
      qc.invalidateQueries({ queryKey: queryKeys.ot.queueAll })
      qc.invalidateQueries({ queryKey: queryKeys.ot.hoursAll })
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
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.events })
      qc.invalidateQueries({ queryKey: queryKeys.callout.list(vars.eventId) })
    },
  })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, ...payload }: { eventId: string; displaced_user_id: string; reason?: string }) =>
      calloutApi.createBumpRequest(eventId, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.bumpRequests(vars.eventId) })
      qc.invalidateQueries({ queryKey: queryKeys.callout.events })
    },
  })
}

export function useReviewBumpRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, ...payload }: { requestId: string; approved: boolean; reason?: string }) =>
      calloutApi.reviewBumpRequest(requestId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.callout.bumpRequestsAll })
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
      qc.invalidateQueries({ queryKey: queryKeys.bidding.all })
    },
  })
}

export function useApproveBidWindow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (windowId: string) => biddingApi.approveBidWindow(windowId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.bidding.all })
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

export function useOtByPeriodReport(params: { start_date: string; end_date: string; classification_id?: string }) {
  return useQuery({
    queryKey: queryKeys.reports.otByPeriod(params),
    queryFn: () => reportsApi.otByPeriod(params),
    enabled: !!params.start_date && !!params.end_date,
  })
}

export function useWorkSummaryReport(params: { start_date: string; end_date: string; user_id?: string }) {
  return useQuery({
    queryKey: queryKeys.reports.workSummary(params),
    queryFn: () => reportsApi.workSummary(params),
    enabled: !!params.start_date && !!params.end_date,
  })
}

// -- Saved Filters --

export function useSavedFilters(page: string) {
  return useQuery({
    queryKey: queryKeys.savedFilters.byPage(page),
    queryFn: () => savedFiltersApi.list(page),
    enabled: !!page,
  })
}

export function useCreateSavedFilter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: savedFiltersApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.savedFilters.all }),
  })
}

export function useDeleteSavedFilter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: savedFiltersApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.savedFilters.all }),
  })
}

export function useSetSavedFilterDefault() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_default }: { id: string; is_default: boolean }) =>
      savedFiltersApi.setDefault(id, is_default),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.savedFilters.all }),
  })
}

// -- Shift Patterns --

export function useShiftPatterns() {
  return useQuery({
    queryKey: queryKeys.shiftPatterns.all,
    queryFn: shiftPatternsApi.list,
  })
}

export function useCreateShiftPattern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: shiftPatternsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shiftPatterns.all }),
  })
}

export function useUpdateShiftPattern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; pattern_days?: number; work_days?: number; off_days?: number; anchor_date?: string; team_id?: string | null; is_active?: boolean; work_days_in_cycle?: number[] | null }) =>
      shiftPatternsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shiftPatterns.all }),
  })
}

export function useDeleteShiftPattern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: shiftPatternsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shiftPatterns.all }),
  })
}

export function useShiftPatternCycle(id: string, date: string) {
  return useQuery({
    queryKey: queryKeys.shiftPatterns.cycle(id, date),
    queryFn: () => shiftPatternsApi.cycle(id, date),
    enabled: !!id && !!date,
  })
}

export function useShiftPatternAssignments() {
  return useQuery({
    queryKey: queryKeys.shiftPatterns.assignments,
    queryFn: shiftPatternsApi.listAssignments,
  })
}

export function useCreateShiftPatternAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: shiftPatternsApi.createAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shiftPatterns.assignments }),
  })
}

export function useDeleteShiftPatternAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: shiftPatternsApi.deleteAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shiftPatterns.assignments }),
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

// -- Coverage Plans --

export function useCoveragePlans() {
  return useQuery({
    queryKey: queryKeys.coveragePlans.list,
    queryFn: coveragePlansApi.listPlans,
  })
}

export function useCoveragePlan(id: string) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.detail(id),
    queryFn: () => coveragePlansApi.getPlan(id),
    enabled: !!id,
  })
}

export function useCreateCoveragePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coveragePlansApi.createPlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.list }),
  })
}

export function useUpdateCoveragePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string; is_default?: boolean; is_active?: boolean }) =>
      coveragePlansApi.updatePlan(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.list })
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.detail(vars.id) })
    },
  })
}

export function useDeleteCoveragePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coveragePlansApi.deletePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.list }),
  })
}

export function useCoveragePlanSlots(planId: string) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.slots(planId),
    queryFn: () => coveragePlansApi.listSlots(planId),
    enabled: !!planId,
  })
}

export function useBulkUpsertSlots() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, slots }: { planId: string; slots: SlotEntry[] }) =>
      coveragePlansApi.bulkUpsertSlots(planId, slots),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.slots(vars.planId) })
    },
  })
}

export function useCoveragePlanAssignments() {
  return useQuery({
    queryKey: queryKeys.coveragePlans.assignments,
    queryFn: coveragePlansApi.listAssignments,
  })
}

export function useCreateCoveragePlanAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coveragePlansApi.createAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.assignments }),
  })
}

export function useDeleteCoveragePlanAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coveragePlansApi.deleteAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.assignments }),
  })
}

export function useResolvedCoverage(date: string) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.resolved(date),
    queryFn: () => coveragePlansApi.getResolved(date),
    enabled: !!date,
    staleTime: 30_000,
  })
}

export function useCoverageGaps(date: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.gaps(date),
    queryFn: () => coveragePlansApi.getGaps(date),
    enabled: (options?.enabled ?? true) && !!date,
    staleTime: 30_000,
  })
}

export function useSendSmsAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, classification_id }: { date: string; classification_id?: string }) =>
      coveragePlansApi.sendSmsAlert(date, classification_id ? { classification_id } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.coveragePlans.all })
    },
  })
}

// -- Nav badges --

export function useNavBadges() {
  return useQuery({
    queryKey: queryKeys.nav.badges,
    queryFn: navApi.badges,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })
}

// -- Notifications --

export function useNotifications(params?: NotificationListParams) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => notificationsApi.list(params),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationsApi.unreadCount,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

// -- Duty Positions --

export function useDutyPositions() {
  return useQuery({
    queryKey: queryKeys.dutyPositions.all,
    queryFn: dutyPositionsApi.list,
  })
}

export function useCreateDutyPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyPositionsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dutyPositions.all }),
  })
}

export function useUpdateDutyPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; classification_id?: string | null; sort_order?: number; is_active?: boolean }) =>
      dutyPositionsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dutyPositions.all }),
  })
}

export function useDeleteDutyPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyPositionsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dutyPositions.all }),
  })
}

export function useDutyAssignments(date: string, shiftTemplateId?: string) {
  return useQuery({
    queryKey: queryKeys.dutyPositions.assignments(date, shiftTemplateId),
    queryFn: () => dutyPositionsApi.listAssignments({ date, shift_template_id: shiftTemplateId }),
    enabled: !!date,
  })
}

export function useCreateDutyAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyPositionsApi.createAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty-assignments'] }),
  })
}

export function useUpdateDutyAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; user_id?: string; notes?: string | null }) =>
      dutyPositionsApi.updateAssignment(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty-assignments'] }),
  })
}

export function useDeleteDutyAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyPositionsApi.deleteAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty-assignments'] }),
  })
}

// -- Special Assignments --

export function useSpecialAssignments(params?: SpecialAssignmentListParams) {
  return useQuery({
    queryKey: queryKeys.specialAssignments.list(params),
    queryFn: () => specialAssignmentsApi.list(params),
  })
}

export function useCreateSpecialAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: specialAssignmentsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.specialAssignments.all })
    },
  })
}

export function useUpdateSpecialAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; assignment_type?: string; end_date?: string | null; notes?: string | null }) =>
      specialAssignmentsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.specialAssignments.all })
    },
  })
}

export function useDeleteSpecialAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: specialAssignmentsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.specialAssignments.all })
    },
  })
}

// -- Staffing --

export function useStaffingAvailable(date: string, shiftTemplateId: string, classificationId?: string) {
  return useQuery({
    queryKey: queryKeys.staffing.available(date, shiftTemplateId, classificationId),
    queryFn: () => staffingApi.getAvailable({ date, shift_template_id: shiftTemplateId, classification_id: classificationId }),
    enabled: !!date && !!shiftTemplateId,
    staleTime: 15_000,
  })
}

export function useBlockAvailable(date: string, classificationId: string, blockStart: string, blockEnd: string) {
  return useQuery({
    queryKey: queryKeys.staffing.blockAvailable(date, classificationId, blockStart, blockEnd),
    queryFn: () => staffingApi.blockAvailable({ date, classification_id: classificationId, block_start: blockStart, block_end: blockEnd }),
    enabled: !!date && !!classificationId && !!blockStart && !!blockEnd,
    staleTime: 15_000,
  })
}

export function useMandatoryOtOrder(classificationId: string) {
  return useQuery({
    queryKey: queryKeys.staffing.mandatoryOtOrder(classificationId),
    queryFn: () => staffingApi.mandatoryOtOrder({ classification_id: classificationId }),
    enabled: !!classificationId,
    staleTime: 30_000,
  })
}

export function useDayGrid(date: string) {
  return useQuery({
    queryKey: queryKeys.coveragePlans.dayGrid(date),
    queryFn: () => coveragePlansApi.dayGrid(date),
    enabled: !!date,
    staleTime: 30_000,
  })
}
