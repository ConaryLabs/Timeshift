import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, type NotificationListParams, type NotificationListResponse, type Notification } from '@/api/notifications'
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
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: queryKeys.notifications.all })

      // Snapshot all notification list queries and unread count
      const previousLists = qc.getQueriesData<NotificationListResponse>({
        queryKey: queryKeys.notifications.all,
      })
      const previousUnread = qc.getQueryData<{ count: number }>(queryKeys.notifications.unreadCount)

      const now = new Date().toISOString()

      // Optimistically update all notification list caches
      qc.setQueriesData<NotificationListResponse>(
        { queryKey: queryKeys.notifications.all },
        (old) => {
          if (!old || !('notifications' in old)) return old
          const alreadyRead = old.notifications.find((n: Notification) => n.id === id)?.is_read
          return {
            ...old,
            notifications: old.notifications.map((n: Notification) =>
              n.id === id ? { ...n, is_read: true, read_at: now } : n,
            ),
            unread_count: alreadyRead ? old.unread_count : Math.max(0, old.unread_count - 1),
          }
        },
      )

      // Optimistically update unread count
      if (previousUnread) {
        const wasAlreadyRead = previousLists.some(([, data]) =>
          data?.notifications.find((n: Notification) => n.id === id)?.is_read,
        )
        if (!wasAlreadyRead) {
          qc.setQueryData<{ count: number }>(queryKeys.notifications.unreadCount, {
            count: Math.max(0, previousUnread.count - 1),
          })
        }
      }

      return { previousLists, previousUnread }
    },
    onError: (_err, _id, context) => {
      // Rollback all notification list caches
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          qc.setQueryData(key, data)
        }
      }
      if (context?.previousUnread) {
        qc.setQueryData(queryKeys.notifications.unreadCount, context.previousUnread)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.notifications.all })

      const previousLists = qc.getQueriesData<NotificationListResponse>({
        queryKey: queryKeys.notifications.all,
      })
      const previousUnread = qc.getQueryData<{ count: number }>(queryKeys.notifications.unreadCount)

      const now = new Date().toISOString()

      // Mark all notifications as read in all cached lists
      qc.setQueriesData<NotificationListResponse>(
        { queryKey: queryKeys.notifications.all },
        (old) => {
          if (!old || !('notifications' in old)) return old
          return {
            ...old,
            notifications: old.notifications.map((n: Notification) => ({
              ...n,
              is_read: true,
              read_at: n.read_at ?? now,
            })),
            unread_count: 0,
          }
        },
      )

      // Zero out unread count
      qc.setQueryData<{ count: number }>(queryKeys.notifications.unreadCount, { count: 0 })

      return { previousLists, previousUnread }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          qc.setQueryData(key, data)
        }
      }
      if (context?.previousUnread) {
        qc.setQueryData(queryKeys.notifications.unreadCount, context.previousUnread)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.delete,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: queryKeys.notifications.all })

      const previousLists = qc.getQueriesData<NotificationListResponse>({
        queryKey: queryKeys.notifications.all,
      })
      const previousUnread = qc.getQueryData<{ count: number }>(queryKeys.notifications.unreadCount)

      // Find whether the deleted notification was unread
      let wasUnread = false
      for (const [, data] of previousLists) {
        const found = data?.notifications.find((n: Notification) => n.id === id)
        if (found) {
          wasUnread = !found.is_read
          break
        }
      }

      // Remove the notification from all cached lists
      qc.setQueriesData<NotificationListResponse>(
        { queryKey: queryKeys.notifications.all },
        (old) => {
          if (!old || !('notifications' in old)) return old
          const hadNotification = old.notifications.some((n: Notification) => n.id === id)
          const notificationWasUnread = old.notifications.find((n: Notification) => n.id === id && !n.is_read)
          return {
            ...old,
            notifications: old.notifications.filter((n: Notification) => n.id !== id),
            total: hadNotification ? old.total - 1 : old.total,
            unread_count: notificationWasUnread
              ? Math.max(0, old.unread_count - 1)
              : old.unread_count,
          }
        },
      )

      // Update unread count if deleted notification was unread
      if (wasUnread && previousUnread) {
        qc.setQueryData<{ count: number }>(queryKeys.notifications.unreadCount, {
          count: Math.max(0, previousUnread.count - 1),
        })
      }

      return { previousLists, previousUnread }
    },
    onError: (_err, _id, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          qc.setQueryData(key, data)
        }
      }
      if (context?.previousUnread) {
        qc.setQueryData(queryKeys.notifications.unreadCount, context.previousUnread)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}
