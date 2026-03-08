// frontend/src/hooks/useEmployee.ts
import { useQuery } from '@tanstack/react-query'
import { employeeApi } from '@/api/employee'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useMyPreferences() {
  return useQuery({
    queryKey: queryKeys.employee.preferences,
    queryFn: employeeApi.getPreferences,
  })
}

export function useUpdateMyPreferences() {
  return useInvalidatingMutation(employeeApi.updatePreferences, [queryKeys.employee.preferences])
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
