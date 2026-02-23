import { api } from './client'

export type CalloutStep =
  | 'volunteers'
  | 'low_ot_hours'
  | 'inverse_seniority'
  | 'equal_ot_hours'
  | 'mandatory'

export interface OtQueueEntry {
  user_id: string
  first_name: string
  last_name: string
  employee_id: string | null
  last_ot_event_at: string | null
  ot_hours_worked: number
  ot_hours_declined: number
}

export interface OtHoursEntry {
  user_id: string
  first_name: string
  last_name: string
  classification_id: string | null
  classification_name: string | null
  fiscal_year: number
  hours_worked: number
  hours_declined: number
}

export interface OtVolunteer {
  id: string
  callout_event_id: string
  user_id: string
  first_name: string
  last_name: string
  volunteered_at: string
}

export const otApi = {
  getQueue: (classificationId: string, fiscalYear?: number) =>
    api
      .get<OtQueueEntry[]>('/api/ot/queue', {
        params: { classification_id: classificationId, fiscal_year: fiscalYear },
      })
      .then((r) => r.data),

  setQueuePosition: (body: {
    classification_id: string
    fiscal_year?: number
    user_id: string
    last_ot_event_at: string | null
  }) => api.patch('/api/ot/queue/set-position', body).then((r) => r.data),

  getHours: (params?: {
    user_id?: string
    fiscal_year?: number
    classification_id?: string
  }) => api.get<OtHoursEntry[]>('/api/ot/hours', { params }).then((r) => r.data),

  adjustHours: (body: {
    user_id: string
    fiscal_year: number
    classification_id?: string
    hours_worked_delta?: number
    hours_declined_delta?: number
  }) => api.post('/api/ot/hours/adjust', body).then((r) => r.data),

  volunteer: (eventId: string) =>
    api.post(`/api/callout/events/${eventId}/volunteer`).then((r) => r.data),

  listVolunteers: (eventId: string) =>
    api
      .get<OtVolunteer[]>(`/api/callout/events/${eventId}/volunteers`)
      .then((r) => r.data),

  advanceStep: (eventId: string, step: CalloutStep) =>
    api
      .patch(`/api/callout/events/${eventId}/step`, { step })
      .then((r) => r.data),
}
