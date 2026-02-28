import { apiClient } from './client'

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
    apiClient.get<LeaveTypeRecord[]>('/api/leave/types'),

  list: (params?: { limit?: number; offset?: number; status?: string }) =>
    apiClient.get<LeaveRequest[]>('/api/leave', { params }),

  get: (id: string) =>
    apiClient.get<LeaveRequest>(`/api/leave/${id}`),

  create: (body: CreateLeaveBody) =>
    apiClient.post<LeaveRequest>('/api/leave', body),

  cancel: (id: string) =>
    apiClient.patch(`/api/leave/${id}/cancel`),

  review: (
    id: string,
    body: { status: 'approved' | 'denied'; reviewer_notes?: string },
  ) => apiClient.patch<LeaveRequest>(`/api/leave/${id}/review`, body),

  bulkReview: (body: { ids: string[]; status: 'approved' | 'denied'; reviewer_notes?: string }) =>
    apiClient.post<{ ok: boolean; reviewed: number }>('/api/leave/bulk-review', body),
}
