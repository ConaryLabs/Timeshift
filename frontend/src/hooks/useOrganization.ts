import { useQuery } from '@tanstack/react-query'
import { classificationsApi } from '@/api/classifications'
import { organizationApi } from '@/api/organization'
import { bargainingUnitsApi } from '@/api/bargainingUnits'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

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
    queryKey: queryKeys.classifications.list(params),
    queryFn: () => classificationsApi.list(params),
  })
}

export function useCreateClassification() {
  return useInvalidatingMutation(classificationsApi.create, [queryKeys.classifications.all])
}

export function useUpdateClassification() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; name?: string; abbreviation?: string; display_order?: number; is_active?: boolean }) =>
      classificationsApi.update(id, body),
    [queryKeys.classifications.all],
  )
}

// -- Organization --

export function useOrganization() {
  return useQuery({
    queryKey: queryKeys.organization.current,
    queryFn: organizationApi.get,
  })
}

export function useUpdateOrganization() {
  return useInvalidatingMutation(organizationApi.update, [queryKeys.organization.current])
}

// -- Org Settings --

export function useOrgSettings() {
  return useQuery({
    queryKey: queryKeys.orgSettings.all,
    queryFn: organizationApi.listSettings,
  })
}

export function useSetOrgSetting() {
  return useInvalidatingMutation(organizationApi.setSetting, [queryKeys.orgSettings.all])
}
