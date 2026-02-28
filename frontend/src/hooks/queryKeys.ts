import type { TradeListParams } from '@/api/trades'
import type { OtRequestListParams } from '@/api/otRequests'
import type { NotificationListParams } from '@/api/notifications'
import type { SpecialAssignmentListParams } from '@/api/specialAssignments'

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  bargainingUnits: {
    all: ['bargainingUnits'] as const,
  },
  classifications: {
    all: ['classifications'] as const,
    list: (params?: Record<string, unknown>) => ['classifications', params] as const,
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
    gapBlocks: (date: string) => ['coverage-plans', 'gap-blocks', date] as const,
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
    list: (params?: { limit?: number; offset?: number; status?: string }) => ['leave', params] as const,
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
  dutyBoard: {
    all: ['duty-board'] as const,
    board: (date: string) => ['duty-board', date] as const,
    available: (date: string, blockIndex: number, positionId: string) =>
      ['duty-board', date, 'available', blockIndex, positionId] as const,
    consoleHours: (startDate: string, endDate: string) =>
      ['duty-board', 'console-hours', startDate, endDate] as const,
  },
  qualifications: {
    all: ['qualifications'] as const,
    position: (positionId: string) => ['qualifications', 'position', positionId] as const,
    user: (userId: string) => ['qualifications', 'user', userId] as const,
  },
  specialAssignments: {
    all: ['special-assignments'] as const,
    list: (params?: SpecialAssignmentListParams) => ['special-assignments', params] as const,
    detail: (id: string) => ['special-assignments', id] as const,
  },
  staffing: {
    all: ['staffing'] as const,
    available: (date: string, shiftTemplateId: string, classificationId?: string) =>
      ['staffing', 'available', date, shiftTemplateId, classificationId] as const,
    blockAvailable: (date: string, classificationId: string, blockStart: string, blockEnd: string) =>
      ['staffing', 'block-available', date, classificationId, blockStart, blockEnd] as const,
    mandatoryOtOrder: (classificationId: string) =>
      ['staffing', 'mandatory-ot-order', classificationId] as const,
  },
} as const
