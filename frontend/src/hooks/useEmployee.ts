import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeApi, type UpdatePreferencesRequest } from '@/api/employee'
import { queryKeys } from './queryKeys'

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
