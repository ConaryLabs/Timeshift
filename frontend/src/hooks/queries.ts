// Barrel file — re-exports everything from domain hook files.
// All imports from '@/hooks/queries' continue to work unchanged.

export { queryKeys } from './queryKeys'

export { useMe } from './useAuth'

export {
  useBargainingUnits,
  useClassifications,
  useCreateClassification,
  useUpdateClassification,
  useOrganization,
  useUpdateOrganization,
  useOrgSettings,
  useSetOrgSetting,
} from './useOrganization'

export {
  useTeams,
  useTeam,
  useCreateTeam,
  useUpdateTeam,
  useTeamSlots,
  useCreateSlot,
  useUpdateSlot,
} from './useTeams'

export {
  useUsers,
  useUserDirectory,
  useUser,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
} from './useUsers'

export {
  useStaffing,
  useCreateAssignment,
  useDeleteAssignment,
  useScheduleGrid,
  useDayView,
  useDashboard,
  useAnnotations,
  useCreateAnnotation,
  useDeleteAnnotation,
  useSchedulePeriods,
  useCreatePeriod,
  useUpdateSchedulePeriod,
  useSlotAssignments,
  useAssignSlot,
  useRemoveSlotAssignment,
  useShiftTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useScheduledShifts,
} from './useSchedule'

export {
  useLeaveTypes,
  useLeaveRequests,
  useCreateLeave,
  useReviewLeave,
  useBulkReviewLeave,
  useCancelLeave,
  useLeaveBalances,
  useLeaveBalanceHistory,
  useAdjustLeaveBalance,
  useAccrualSchedules,
  useCreateAccrualSchedule,
  useUpdateAccrualSchedule,
  useDeleteAccrualSchedule,
  useSellbackRequests,
  useCreateSellback,
  useReviewSellback,
  useCancelSellback,
  useDonations,
  useCreateDonation,
  useReviewDonation,
  useCancelDonation,
} from './useLeave'

export {
  useCalloutEvents,
  useCalloutList,
  useCreateCalloutEvent,
  useRecordAttempt,
  useCancelCalloutEvent,
  useCancelCalloutOtAssignment,
  useCalloutVolunteers,
  useAdvanceCalloutStep,
  useBumpRequests,
  useCreateBumpRequest,
  useReviewBumpRequest,
} from './useCallout'

export {
  useOtQueue,
  useSetOtQueuePosition,
  useOtHours,
  useAdjustOtHours,
  useVolunteer,
  useOtRequests,
  useOtRequest,
  useCreateOtRequest,
  useVolunteerOtRequest,
  useWithdrawVolunteerOtRequest,
  useAssignOtRequest,
  useUpdateOtRequest,
  useCancelOtRequest,
  useCancelOtAssignment,
} from './useOt'

export {
  useTrades,
  useTrade,
  useCreateTrade,
  useRespondTrade,
  useReviewTrade,
  useBulkReviewTrade,
  useCancelTrade,
} from './useTrades'

export {
  useVacationBidPeriods,
  useVacationBidWindows,
  useVacationBidWindow,
  useCreateVacationBidPeriod,
  useDeleteVacationBidPeriod,
  useOpenVacationBidding,
  useSubmitVacationBid,
  useProcessVacationBids,
} from './useVacationBids'

export {
  useBidWindows,
  useBidWindow,
  useOpenBidding,
  useSubmitBid,
  useProcessBids,
  useApproveBidWindow,
} from './useBidding'

export {
  useMyPreferences,
  useUpdateMyPreferences,
  useMySchedule,
  useMyDashboard,
} from './useEmployee'

export {
  useHolidays,
  useCreateHoliday,
  useUpdateHoliday,
  useDeleteHoliday,
} from './useHolidays'

export {
  useCoverageReport,
  useOtSummaryReport,
  useLeaveSummaryReport,
  useOtByPeriodReport,
  useWorkSummaryReport,
} from './useReports'

export {
  useSavedFilters,
  useCreateSavedFilter,
  useDeleteSavedFilter,
  useSetSavedFilterDefault,
} from './useSavedFilters'

export {
  useShiftPatterns,
  useCreateShiftPattern,
  useUpdateShiftPattern,
  useDeleteShiftPattern,
  useShiftPatternCycle,
  useShiftPatternAssignments,
  useCreateShiftPatternAssignment,
  useDeleteShiftPatternAssignment,
} from './useShiftPatterns'

export {
  useCoveragePlans,
  useCoveragePlan,
  useCreateCoveragePlan,
  useUpdateCoveragePlan,
  useDeleteCoveragePlan,
  useCoveragePlanSlots,
  useBulkUpsertSlots,
  useCoveragePlanAssignments,
  useCreateCoveragePlanAssignment,
  useDeleteCoveragePlanAssignment,
  useResolvedCoverage,
  useCoverageGaps,
  useCoverageGapBlocks,
  useSendSmsAlert,
  useDayGrid,
} from './useCoverage'

export { useNavBadges } from './useNav'

export {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from './useNotifications'

export {
  useDutyPositions,
  useCreateDutyPosition,
  useUpdateDutyPosition,
  useDeleteDutyPosition,
  useDutyAssignments,
  useCreateDutyAssignment,
  useUpdateDutyAssignment,
  useDeleteDutyAssignment,
} from './useDutyPositions'

export {
  useSpecialAssignments,
  useCreateSpecialAssignment,
  useUpdateSpecialAssignment,
  useDeleteSpecialAssignment,
} from './useSpecialAssignments'

export {
  useStaffingAvailable,
  useBlockAvailable,
  useMandatoryOtOrder,
} from './useStaffing'
