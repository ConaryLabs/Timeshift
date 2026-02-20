import { api } from './client'

export type LeaveStatus = 'pending' | 'approved' | 'denied' | 'cancelled'

export interface LeaveTypeRecord {
  id: string
  org_id: string
  code: string
  name: string
  requires_approval: boolean
  is_reported: boolean
  draws_from: string | null
  display_order: number
  is_active: boolean
  created_at: string
}

export interface LeaveRequest {
  id: string
  user_id: string
  first_name: string
  last_name: string
  leave_type_id: string
  leave_type_code: string
  leave_type_name: string
  start_date: string
  end_date: string
  hours: number | null
  reason: string | null
  status: LeaveStatus
  reviewed_by: string | null
  reviewer_notes: string | null
  created_at: string
  updated_at: string
}

export const leaveApi = {
  listTypes: () =>
    api.get<LeaveTypeRecord[]>('/api/leave/types').then((r) => r.data),

  list: () => api.get<LeaveRequest[]>('/api/leave').then((r) => r.data),

  get: (id: string) =>
    api.get<LeaveRequest>(`/api/leave/${id}`).then((r) => r.data),

  create: (body: {
    leave_type_id: string
    start_date: string
    end_date: string
    hours?: number
    reason?: string
  }) => api.post<LeaveRequest>('/api/leave', body).then((r) => r.data),

  cancel: (id: string) =>
    api.delete(`/api/leave/${id}`).then((r) => r.data),

  review: (
    id: string,
    body: { status: 'approved' | 'denied'; reviewer_notes?: string },
  ) => api.patch<LeaveRequest>(`/api/leave/${id}/review`, body).then((r) => r.data),
}
