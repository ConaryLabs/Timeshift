// frontend/src/api/sickDonation.ts
import { apiClient } from './client'

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
    apiClient.get<SickLeaveDonation[]>('/api/leave/donations'),

  create: (body: {
    recipient_id: string
    leave_type_id: string
    hours: number
    fiscal_year: number
  }) => apiClient.post<SickLeaveDonation>('/api/leave/donations', body),

  review: (id: string, body: { status: string; reviewer_notes?: string }) =>
    apiClient.patch<SickLeaveDonation>(`/api/leave/donations/${id}/review`, body),

  cancel: (id: string) =>
    apiClient.patch(`/api/leave/donations/${id}/cancel`),
}
