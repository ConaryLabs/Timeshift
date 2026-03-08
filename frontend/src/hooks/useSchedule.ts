// frontend/src/hooks/useSchedule.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { schedulePeriodsApi } from '@/api/schedulePeriods'
import { shiftsApi } from '@/api/shifts'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

// -- Schedule --

export function useStaffing(startDate: string, endDate: string, teamId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.schedule.staffing(startDate, endDate, teamId),
    queryFn: () => scheduleApi.getStaffing(startDate, endDate, teamId),
    enabled: (options?.enabled ?? true) && !!startDate && !!endDate,
  })
}

export function useCreateAssignment() {
  return useInvalidatingMutation(scheduleApi.createAssignment, [
    queryKeys.schedule.all,
    queryKeys.coveragePlans.all,
    queryKeys.staffing.all,
  ])
}

export function useDeleteAssignment() {
  return useInvalidatingMutation(scheduleApi.deleteAssignment, [
    queryKeys.schedule.all,
    queryKeys.coveragePlans.all,
    queryKeys.staffing.all,
  ])
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
  return useInvalidatingMutation(scheduleApi.createAnnotation, [
    queryKeys.schedule.annotations,
    queryKeys.schedule.dashboard,
  ])
}

export function useDeleteAnnotation() {
  return useInvalidatingMutation(scheduleApi.deleteAnnotation, [
    queryKeys.schedule.annotations,
    queryKeys.schedule.dashboard,
  ])
}

// -- Schedule Periods --

export function useSchedulePeriods() {
  return useQuery({
    queryKey: queryKeys.periods.all,
    queryFn: schedulePeriodsApi.list,
  })
}

export function useCreatePeriod() {
  return useInvalidatingMutation(schedulePeriodsApi.create, [queryKeys.periods.all])
}

export function useUpdateSchedulePeriod() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; name?: string; start_date?: string; end_date?: string; bargaining_unit?: string | null }) =>
      schedulePeriodsApi.update(id, body),
    [queryKeys.periods.all],
  )
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
  return useInvalidatingMutation(scheduleApi.createTemplate, [queryKeys.shifts.templates])
}

export function useUpdateTemplate() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; name?: string; color?: string; is_active?: boolean; expected_updated_at?: string }) =>
      scheduleApi.updateTemplate(id, body),
    [queryKeys.shifts.templates],
  )
}

// -- Scheduled Shifts --

export function useScheduledShifts(params?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: queryKeys.shifts.scheduled(params),
    queryFn: () => shiftsApi.listScheduled(params),
  })
}
