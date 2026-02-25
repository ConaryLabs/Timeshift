import { api } from './client'

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
    api.get<SpecialAssignment[]>('/api/special-assignments', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<SpecialAssignment>(`/api/special-assignments/${id}`).then((r) => r.data),

  create: (body: CreateSpecialAssignment) =>
    api.post<SpecialAssignment>('/api/special-assignments', body).then((r) => r.data),

  update: (id: string, body: UpdateSpecialAssignment) =>
    api.patch<SpecialAssignment>(`/api/special-assignments/${id}`, body).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/special-assignments/${id}`).then((r) => r.data),
}
