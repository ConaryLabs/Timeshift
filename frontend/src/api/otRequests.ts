import { api } from './client'

export type OtRequestStatus = 'open' | 'partially_filled' | 'filled' | 'cancelled'
export type OtType = 'voluntary' | 'mandatory' | 'fixed_coverage'

export interface OtRequest {
  id: string
  org_id: string
  date: string
  start_time: string
  end_time: string
  hours: number
  classification_id: string
  classification_name: string
  ot_reason_id: string | null
  ot_reason_name: string | null
  location: string | null
  is_fixed_coverage: boolean
  notes: string | null
  status: OtRequestStatus
  created_by: string
  created_by_name: string
  volunteer_count: number
  assignment_count: number
  created_at: string
  updated_at: string
  cancelled_at: string | null
  cancelled_by: string | null
}

export interface OtRequestVolunteer {
  id: string
  user_id: string
  user_name: string
  user_email: string
  classification_name: string
  volunteered_at: string
  withdrawn_at: string | null
}

export interface OtRequestAssignment {
  id: string
  user_id: string
  user_name: string
  ot_type: OtType
  assigned_by: string
  assigned_by_name: string
  assigned_at: string
  cancelled_at: string | null
}

export interface OtRequestDetail extends OtRequest {
  volunteers: OtRequestVolunteer[]
  assignments: OtRequestAssignment[]
}

export interface CreateOtRequest {
  date: string
  start_time: string
  end_time: string
  classification_id: string
  ot_reason_id?: string
  location?: string
  is_fixed_coverage: boolean
  notes?: string
}

export interface CreateOtRequestAssignment {
  user_id: string
  ot_type?: OtType
}

export interface OtRequestListParams {
  status?: string
  date_from?: string
  date_to?: string
  classification_id?: string
  volunteered_by_me?: boolean
}

export const otRequestsApi = {
  list: (params?: OtRequestListParams) =>
    api.get<OtRequest[]>('/api/ot-requests', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<OtRequestDetail>(`/api/ot-requests/${id}`).then((r) => r.data),

  create: (data: CreateOtRequest) =>
    api.post<OtRequest>('/api/ot-requests', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateOtRequest & { status: string }>) =>
    api.patch<OtRequest>(`/api/ot-requests/${id}`, data).then((r) => r.data),

  cancel: (id: string) =>
    api.patch(`/api/ot-requests/${id}/cancel`).then((r) => r.data),

  volunteer: (id: string) =>
    api.post(`/api/ot-requests/${id}/volunteer`).then((r) => r.data),

  withdrawVolunteer: (id: string) =>
    api.patch(`/api/ot-requests/${id}/volunteer/withdraw`).then((r) => r.data),

  assign: (id: string, data: CreateOtRequestAssignment) =>
    api.post(`/api/ot-requests/${id}/assign`, data).then((r) => r.data),

  cancelAssignment: (id: string, userId: string) =>
    api.delete(`/api/ot-requests/${id}/assign/${userId}`).then((r) => r.data),
}
