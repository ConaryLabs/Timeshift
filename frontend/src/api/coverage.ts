import { api } from './client'

export interface CoverageRequirement {
  id: string
  org_id: string
  shift_template_id: string
  classification_id: string
  day_of_week: number
  min_headcount: number
  target_headcount: number
  max_headcount: number
  effective_date: string
  created_at: string
}

export interface CreateCoverageRequirementBody {
  shift_template_id: string
  classification_id: string
  day_of_week: number
  min_headcount: number
  target_headcount: number
  max_headcount: number
  effective_date?: string
}

export interface UpdateCoverageRequirementBody {
  min_headcount?: number
  target_headcount?: number
  max_headcount?: number
}

export const coverageApi = {
  list: (params?: { shift_template_id?: string; classification_id?: string }) =>
    api.get<CoverageRequirement[]>('/api/coverage', { params }).then((r) => r.data),

  create: (body: CreateCoverageRequirementBody) =>
    api.post<CoverageRequirement>('/api/coverage', body).then((r) => r.data),

  update: (id: string, body: UpdateCoverageRequirementBody) =>
    api.patch<CoverageRequirement>(`/api/coverage/${id}`, body).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/coverage/${id}`).then((r) => r.data),
}
