import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { classificationsApi } from '@/api/classifications'
import { organizationApi } from '@/api/organization'
import { bargainingUnitsApi } from '@/api/bargainingUnits'
import { queryKeys } from './queryKeys'

// -- Bargaining Units --

export function useBargainingUnits() {
  return useQuery({
    queryKey: queryKeys.bargainingUnits.all,
    queryFn: bargainingUnitsApi.list,
  })
}

// -- Classifications --

export function useClassifications(params?: { include_inactive?: boolean }) {
  return useQuery({
    queryKey: [...queryKeys.classifications.all, params],
    queryFn: () => classificationsApi.list(params),
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
