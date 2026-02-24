import { api } from './client'

export interface SickLeaveDonation {
  id: string
  org_id: string
  donor_id: string
  recipient_id: string
  leave_type_id: string
  hours: number
  fiscal_year: number
  status: string
  reviewed_by: string | null
  reviewer_notes: string | null
  created_at: string
  updated_at: string
}

export const sickDonationApi = {
  list: () =>
    api.get<SickLeaveDonation[]>('/api/leave/donations').then((r) => r.data),

  create: (body: {
    recipient_id: string
    leave_type_id: string
    hours: number
    fiscal_year: number
  }) => api.post<SickLeaveDonation>('/api/leave/donations', body).then((r) => r.data),

  review: (id: string, body: { status: string; reviewer_notes?: string }) =>
    api.patch<SickLeaveDonation>(`/api/leave/donations/${id}/review`, body).then((r) => r.data),

  cancel: (id: string) =>
    api.patch(`/api/leave/donations/${id}/cancel`).then((r) => r.data),
}
