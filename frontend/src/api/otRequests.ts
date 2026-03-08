// frontend/src/api/otRequests.ts
import { apiClient } from './client'

export type OtRequestStatus = 'open' | 'partially_filled' | 'filled' | 'cancelled'
export type OtType = 'voluntary' | 'mandatory' | 'mandatory_day_off' | 'fixed_coverage'

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
  user_volunteered: boolean
  user_assigned: boolean
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
  /** When true, bypasses the voluntary OT soft-limit warning (12–14 h daily). */
  force?: boolean
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
    apiClient.get<OtRequest[]>('/api/ot-requests', { params }),

  get: (id: string) =>
    apiClient.get<OtRequestDetail>(`/api/ot-requests/${id}`),

  create: (data: CreateOtRequest) =>
    apiClient.post<OtRequest>('/api/ot-requests', data),

  update: (id: string, data: Partial<CreateOtRequest & { status: string; expected_updated_at?: string }>) =>
    apiClient.patch<OtRequest>(`/api/ot-requests/${id}`, data),

  cancel: (id: string) =>
    apiClient.patch(`/api/ot-requests/${id}/cancel`),

  volunteer: (id: string) =>
    apiClient.post(`/api/ot-requests/${id}/volunteer`),

  withdrawVolunteer: (id: string) =>
    apiClient.patch(`/api/ot-requests/${id}/volunteer/withdraw`),

  assign: (id: string, data: CreateOtRequestAssignment) =>
    apiClient.post(`/api/ot-requests/${id}/assign`, data),

  cancelAssignment: (id: string, userId: string) =>
    apiClient.delete(`/api/ot-requests/${id}/assign/${userId}`),
}
