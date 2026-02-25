import { api } from './client'

export interface SavedFilter {
  id: string
  org_id: string
  user_id: string
  name: string
  page: string
  filters: Record<string, unknown>
  is_default: boolean
  created_at: string
}

export const savedFiltersApi = {
  list: (page: string) =>
    api.get<SavedFilter[]>('/api/saved-filters', { params: { page } }).then((r) => r.data),

  create: (data: { name: string; page: string; filters: Record<string, unknown>; is_default?: boolean }) =>
    api.post<SavedFilter>('/api/saved-filters', data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/saved-filters/${id}`).then((r) => r.data),

  setDefault: (id: string, is_default: boolean) =>
    api.patch(`/api/saved-filters/${id}/default`, { is_default }).then((r) => r.data),
}
