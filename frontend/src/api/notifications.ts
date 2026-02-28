import { apiClient } from './client'

export type NotificationType =
  | 'leave_reviewed'
  | 'trade_requested'
  | 'trade_reviewed'
  | 'ot_assigned'
  | 'ot_assignment_cancelled'
  | 'callout_created'
  | 'shift_changed'

export interface Notification {
  id: string
  org_id: string
  user_id: string
  notification_type: NotificationType
  title: string
  message: string
  link: string | null
  source_type: string | null
  source_id: string | null
  is_read: boolean
  created_at: string
  read_at: string | null
}

export interface NotificationListResponse {
  notifications: Notification[]
  total: number
  unread_count: number
}

export interface NotificationListParams {
  unread_only?: boolean
  limit?: number
  offset?: number
}

export const notificationsApi = {
  list: (params?: NotificationListParams) =>
    apiClient.get<NotificationListResponse>('/api/notifications', { params }),

  unreadCount: () =>
    apiClient.get<{ count: number }>('/api/notifications/unread-count'),

  markRead: (id: string) =>
    apiClient.patch<Notification>(`/api/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.post<{ updated: number }>('/api/notifications/read-all'),

  delete: (id: string) =>
    apiClient.delete(`/api/notifications/${id}`),
}
