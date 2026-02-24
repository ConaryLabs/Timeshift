import { api } from './client'

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

const notificationsApi = {
  list: (params?: NotificationListParams) =>
    api.get<NotificationListResponse>('/api/notifications', { params }).then((r) => r.data),

  unreadCount: () =>
    api.get<{ count: number }>('/api/notifications/unread-count').then((r) => r.data),

  markRead: (id: string) =>
    api.patch<Notification>(`/api/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    api.post<{ updated: number }>('/api/notifications/read-all').then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/notifications/${id}`).then((r) => r.data),
}

export default notificationsApi
