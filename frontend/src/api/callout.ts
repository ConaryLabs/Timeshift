import { api } from './client'

export interface CalloutEvent {
  id: string
  scheduled_shift_id: string
  initiated_by: string
  reason: string | null
  status: 'open' | 'filled' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface CalloutListEntry {
  position: number
  user_id: string
  employee_id: string
  first_name: string
  last_name: string
  position_title: string
  seniority_date: string
  ot_hours: number
  is_available: boolean
  unavailable_reason: string | null
}

export const calloutApi = {
  listEvents: () =>
    api.get<CalloutEvent[]>('/api/callout/events').then((r) => r.data),

  createEvent: (body: { scheduled_shift_id: string; reason?: string }) =>
    api.post<CalloutEvent>('/api/callout/events', body).then((r) => r.data),

  getList: (event_id: string) =>
    api
      .get<CalloutListEntry[]>(`/api/callout/events/${event_id}/list`)
      .then((r) => r.data),

  cancelEvent: (event_id: string) =>
    api.post(`/api/callout/events/${event_id}/cancel`).then((r) => r.data),
}
