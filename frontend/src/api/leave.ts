import { api } from './client'

export type LeaveType =
  | 'vacation'
  | 'sick'
  | 'personal_day'
  | 'bereavement'
  | 'fmla'
  | 'military_leave'
  | 'other'

export type LeaveStatus = 'pending' | 'approved' | 'denied' | 'cancelled'

export interface LeaveRequest {
  id: string
  user_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  reason: string | null
  status: LeaveStatus
  reviewed_by: string | null
  reviewer_notes: string | null
  created_at: string
  updated_at: string
}

export const leaveApi = {
  list: () => api.get<LeaveRequest[]>('/api/leave').then((r) => r.data),

  create: (body: {
    leave_type: LeaveType
    start_date: string
    end_date: string
    reason?: string
  }) => api.post<LeaveRequest>('/api/leave', body).then((r) => r.data),

  cancel: (id: string) =>
    api.delete(`/api/leave/${id}`).then((r) => r.data),

  review: (
    id: string,
    body: { status: 'approved' | 'denied'; reviewer_notes?: string },
  ) => api.patch<LeaveRequest>(`/api/leave/${id}/review`, body).then((r) => r.data),
}
