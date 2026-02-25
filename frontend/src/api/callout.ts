import { api } from './client'

import type { CalloutStep } from './ot'

export interface CalloutEvent {
  id: string
  scheduled_shift_id: string
  initiated_by: string
  ot_reason_id: string | null
  reason_text: string | null
  classification_id: string
  classification_name: string
  ot_request_id: string | null
  status: 'open' | 'filled' | 'cancelled'
  current_step: CalloutStep | null
  step_started_at: string | null
  shift_template_name?: string
  shift_date?: string
  team_name?: string
  created_at: string
  updated_at: string
}

export interface CalloutListEntry {
  position: number
  user_id: string
  employee_id: string | null
  first_name: string
  last_name: string
  classification_abbreviation: string | null
  overall_seniority_date: string | null
  ot_hours: number
  is_available: boolean
  unavailable_reason: string | null
  is_cross_class: boolean
}

export interface CalloutAttempt {
  id: string
  event_id: string
  user_id: string
  list_position: number
  contacted_at: string | null
  response: string | null
  ot_hours_at_contact: number
  notes: string | null
}

export interface BumpRequest {
  id: string
  event_id: string
  requesting_user_id: string
  requesting_user_first_name: string
  requesting_user_last_name: string
  displaced_user_id: string
  displaced_user_first_name: string
  displaced_user_last_name: string
  status: 'pending' | 'approved' | 'denied'
  reason: string | null
  created_at: string
  reviewed_at?: string
  reviewed_by?: string
}

export interface CreateBumpRequestPayload {
  displaced_user_id: string
  reason?: string
}

export interface ReviewBumpRequestPayload {
  approved: boolean
  reason?: string
}

export const calloutApi = {
  listEvents: (params?: { limit?: number; offset?: number }) =>
    api.get<CalloutEvent[]>('/api/callout/events', { params }).then((r) => r.data),

  createEvent: (body: {
    scheduled_shift_id: string
    ot_reason_id?: string
    reason_text?: string
    classification_id: string
    ot_request_id?: string
  }) => api.post<CalloutEvent>('/api/callout/events', body).then((r) => r.data),

  getList: (event_id: string) =>
    api
      .get<CalloutListEntry[]>(`/api/callout/events/${event_id}/queue`)
      .then((r) => r.data),

  cancelEvent: (event_id: string) =>
    api.patch(`/api/callout/events/${event_id}/cancel`).then((r) => r.data),

  cancelOtAssignment: (eventId: string) =>
    api.post(`/api/callout/events/${eventId}/cancel-ot`).then((r) => r.data),

  recordAttempt: (
    event_id: string,
    body: { user_id: string; response: string; notes?: string },
  ) =>
    api
      .post<CalloutAttempt>(`/api/callout/events/${event_id}/attempt`, body)
      .then((r) => r.data),

  listBumpRequests: (eventId: string) =>
    api
      .get<BumpRequest[]>(`/api/callout/events/${eventId}/bump-requests`)
      .then((r) => r.data),

  createBumpRequest: (eventId: string, payload: CreateBumpRequestPayload) =>
    api
      .post<BumpRequest>(`/api/callout/events/${eventId}/bump`, payload)
      .then((r) => r.data),

  reviewBumpRequest: (requestId: string, payload: ReviewBumpRequestPayload) =>
    api
      .patch<BumpRequest>(`/api/callout/bump-requests/${requestId}/review`, payload)
      .then((r) => r.data),
}
