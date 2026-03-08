// frontend/src/api/callout.ts
import { apiClient } from './client'

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
  assigned_user_id?: string | null
  assigned_user_name?: string | null
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
  phone: string | null
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
    apiClient.get<CalloutEvent[]>('/api/callout/events', { params }),

  createEvent: (body: {
    scheduled_shift_id: string
    ot_reason_id?: string
    reason_text?: string
    classification_id: string
    ot_request_id?: string
  }) => apiClient.post<CalloutEvent>('/api/callout/events', body),

  getList: (event_id: string) =>
    apiClient.get<CalloutListEntry[]>(`/api/callout/events/${event_id}/queue`),

  cancelEvent: (event_id: string) =>
    apiClient.patch(`/api/callout/events/${event_id}/cancel`),

  cancelOtAssignment: (eventId: string) =>
    apiClient.post(`/api/callout/events/${eventId}/cancel-ot`),

  recordAttempt: (
    event_id: string,
    body: { user_id: string; response: string; notes?: string },
  ) =>
    apiClient.post<CalloutAttempt>(`/api/callout/events/${event_id}/attempt`, body),

  listBumpRequests: (eventId: string) =>
    apiClient.get<BumpRequest[]>(`/api/callout/events/${eventId}/bump-requests`),

  createBumpRequest: (eventId: string, payload: CreateBumpRequestPayload) =>
    apiClient.post<BumpRequest>(`/api/callout/events/${eventId}/bump`, payload),

  reviewBumpRequest: (requestId: string, payload: ReviewBumpRequestPayload) =>
    apiClient.patch<BumpRequest>(`/api/callout/bump-requests/${requestId}/review`, payload),
}
