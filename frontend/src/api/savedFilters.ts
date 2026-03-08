// frontend/src/api/savedFilters.ts
import { apiClient } from './client'

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
    apiClient.get<SavedFilter[]>('/api/saved-filters', { params: { page } }),

  create: (data: { name: string; page: string; filters: Record<string, unknown>; is_default?: boolean }) =>
    apiClient.post<SavedFilter>('/api/saved-filters', data),

  delete: (id: string) =>
    apiClient.delete(`/api/saved-filters/${id}`),

  setDefault: (id: string, is_default: boolean) =>
    apiClient.patch(`/api/saved-filters/${id}/default`, { is_default }),
}
