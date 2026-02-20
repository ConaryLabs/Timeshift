import { api } from './client'

export interface Organization {
  id: string
  name: string
  slug: string
  timezone: string
  created_at: string
  updated_at: string
}

export const organizationApi = {
  get: () =>
    api.get<Organization>('/api/organization').then((r) => r.data),

  update: (body: { name?: string; timezone?: string }) =>
    api.put<Organization>('/api/organization', body).then((r) => r.data),
}
