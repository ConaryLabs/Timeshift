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
  category: string | null
  display_order: number
  is_active: boolean
  created_at: string
}

export interface LeaveSegment {
  id: string
  leave_type_id: string
  leave_type_code: string
  leave_type_name: string
  hours: number
  sort_order: number
}

export interface LeaveRequestLine {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: number
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
  start_time: string | null
  scheduled_shift_id: string | null
  is_rdo: boolean
  reason: string | null
  emergency_contact: string | null
  bereavement_relationship: string | null
  bereavement_name: string | null
  status: LeaveStatus
  reviewed_by: string | null
  reviewer_notes: string | null
  created_at: string
  updated_at: string
  segments: LeaveSegment[]
  lines: LeaveRequestLine[]
}

export interface CreateLeaveSegment {
  leave_type_id: string
  hours: number
}

export interface CreateLeaveRequestLine {
  date: string
  start_time?: string
  end_time?: string
  hours: number
}

export interface CreateLeaveBody {
  leave_type_id: string
  start_date: string
  end_date: string
  hours?: number
  start_time?: string
  scheduled_shift_id?: string
  is_rdo?: boolean
  reason?: string
  emergency_contact?: string
  bereavement_relationship?: string
  bereavement_name?: string
  segments?: CreateLeaveSegment[]
  lines?: CreateLeaveRequestLine[]
}

export const leaveApi = {
  listTypes: () =>
    api.get<LeaveTypeRecord[]>('/api/leave/types').then((r) => r.data),

  list: (params?: { limit?: number; offset?: number; status?: string }) =>
    api.get<LeaveRequest[]>('/api/leave', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<LeaveRequest>(`/api/leave/${id}`).then((r) => r.data),

  create: (body: CreateLeaveBody) =>
    api.post<LeaveRequest>('/api/leave', body).then((r) => r.data),

  cancel: (id: string) =>
    api.patch(`/api/leave/${id}/cancel`).then((r) => r.data),

  review: (
    id: string,
    body: { status: 'approved' | 'denied'; reviewer_notes?: string },
  ) => api.patch<LeaveRequest>(`/api/leave/${id}/review`, body).then((r) => r.data),

  bulkReview: (body: { ids: string[]; status: 'approved' | 'denied'; reviewer_notes?: string }) =>
    api.post<{ ok: boolean; reviewed: number }>('/api/leave/bulk-review', body).then((r) => r.data),
}
