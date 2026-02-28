import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, type NotificationListParams } from '@/api/notifications'
import { queryKeys } from './queryKeys'

export function useNotifications(params?: NotificationListParams) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => notificationsApi.list(params),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationsApi.unreadCount,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}
