import { api } from './client'

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
    api.get<Organization>('/api/organization').then((r) => r.data),

  update: (body: { name?: string; timezone?: string }) =>
    api.patch<Organization>('/api/organization', body).then((r) => r.data),

  listSettings: () =>
    api.get<OrgSetting[]>('/api/organization/settings').then((r) => r.data),

  setSetting: (body: { key: string; value: unknown }) =>
    api.patch<OrgSetting>('/api/organization/settings', body).then((r) => r.data),
}
