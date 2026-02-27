import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/api/reports'
import { queryKeys } from './queryKeys'

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
