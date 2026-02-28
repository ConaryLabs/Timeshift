import { apiClient } from './client'

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
    apiClient.get<OtQueueEntry[]>('/api/ot/queue', {
      params: { classification_id: classificationId, fiscal_year: fiscalYear },
    }),

  setQueuePosition: (body: {
    classification_id: string
    fiscal_year?: number
    user_id: string
    last_ot_event_at: string | null
  }) => apiClient.patch('/api/ot/queue/set-position', body),

  getHours: (params?: {
    user_id?: string
    fiscal_year?: number
    classification_id?: string
  }) => apiClient.get<OtHoursEntry[]>('/api/ot/hours', { params }),

  adjustHours: (body: {
    user_id: string
    fiscal_year: number
    classification_id?: string
    hours_worked_delta?: number
    hours_declined_delta?: number
  }) => apiClient.post('/api/ot/hours/adjust', body),

  volunteer: (eventId: string) =>
    apiClient.post(`/api/callout/events/${eventId}/volunteer`),

  listVolunteers: (eventId: string) =>
    apiClient.get<OtVolunteer[]>(`/api/callout/events/${eventId}/volunteers`),

  advanceStep: (eventId: string, step: CalloutStep) =>
    apiClient.patch(`/api/callout/events/${eventId}/step`, { step }),
}
