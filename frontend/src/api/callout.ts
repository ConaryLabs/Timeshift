import { api } from './client'

export interface CalloutEvent {
  id: string
  scheduled_shift_id: string
  initiated_by: string
  ot_reason_id: string | null
  reason_text: string | null
  classification_id: string | null
  status: 'open' | 'filled' | 'cancelled'
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
  seniority_date: string | null
  ot_hours: number
  is_available: boolean
  unavailable_reason: string | null
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

export const calloutApi = {
  listEvents: () =>
    api.get<CalloutEvent[]>('/api/callout/events').then((r) => r.data),

  createEvent: (body: {
    scheduled_shift_id: string
    ot_reason_id?: string
    reason_text?: string
    classification_id?: string
  }) => api.post<CalloutEvent>('/api/callout/events', body).then((r) => r.data),

  getList: (event_id: string) =>
    api
      .get<CalloutListEntry[]>(`/api/callout/events/${event_id}/list`)
      .then((r) => r.data),

  cancelEvent: (event_id: string) =>
    api.patch(`/api/callout/events/${event_id}/cancel`).then((r) => r.data),

  recordAttempt: (
    event_id: string,
    body: { user_id: string; response: string; notes?: string },
  ) =>
    api
      .post<CalloutAttempt>(`/api/callout/events/${event_id}/attempt`, body)
      .then((r) => r.data),
}
