import { apiClient } from './client'

export interface SpecialAssignment {
  id: string
  org_id: string
  user_id: string
  user_first_name: string
  user_last_name: string
  assignment_type: string
  start_date: string
  end_date: string | null
  notes: string | null
  assigned_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateSpecialAssignment {
  user_id: string
  assignment_type: string
  start_date: string
  end_date?: string | null
  notes?: string | null
}

export interface UpdateSpecialAssignment {
  assignment_type?: string
  end_date?: string | null
  notes?: string | null
}

export interface SpecialAssignmentListParams {
  user_id?: string
  assignment_type?: string
  active_on?: string
}

export const specialAssignmentsApi = {
  list: (params?: SpecialAssignmentListParams) =>
    apiClient.get<SpecialAssignment[]>('/api/special-assignments', { params }),

  get: (id: string) =>
    apiClient.get<SpecialAssignment>(`/api/special-assignments/${id}`),

  create: (body: CreateSpecialAssignment) =>
    apiClient.post<SpecialAssignment>('/api/special-assignments', body),

  update: (id: string, body: UpdateSpecialAssignment) =>
    apiClient.patch<SpecialAssignment>(`/api/special-assignments/${id}`, body),

  delete: (id: string) =>
    apiClient.delete(`/api/special-assignments/${id}`),
}
