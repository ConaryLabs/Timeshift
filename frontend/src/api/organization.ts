import { apiClient } from './client'

export interface Organization {
  id: string
  name: string
  slug: string
  timezone: string
  created_at: string
  updated_at: string
}

export interface OrgSetting {
  id: string
  org_id: string
  key: string
  value: unknown
  updated_at: string
}

export const organizationApi = {
  get: () =>
    apiClient.get<Organization>('/api/organization'),

  update: (body: { name?: string; timezone?: string }) =>
    apiClient.patch<Organization>('/api/organization', body),

  listSettings: () =>
    apiClient.get<OrgSetting[]>('/api/organization/settings'),

  setSetting: (body: { key: string; value: unknown }) =>
    apiClient.patch<OrgSetting>('/api/organization/settings', body),
}
