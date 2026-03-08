// frontend/src/hooks/useNotifications.ts
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { notificationsApi, type NotificationListParams, type NotificationListResponse, type Notification } from '@/api/notifications'
import { queryKeys } from './queryKeys'

type NotificationSnapshot = {
  previousLists: [unknown, NotificationListResponse | undefined][]
  previousUnread: { count: number } | undefined
}

function snapshotNotifications(qc: QueryClient): NotificationSnapshot {
  return {
    previousLists: qc.getQueriesData<NotificationListResponse>({
      queryKey: queryKeys.notifications.all,
    }),
    previousUnread: qc.getQueryData<{ count: number }>(queryKeys.notifications.unreadCount),
  }
}

function rollbackNotifications(qc: QueryClient, snapshot: NotificationSnapshot | undefined): void {
  if (!snapshot) return
  if (snapshot.previousLists) {
    for (const [key, data] of snapshot.previousLists) {
      qc.setQueryData(key as readonly unknown[], data)
    }
  }
  if (snapshot.previousUnread) {
    qc.setQueryData(queryKeys.notifications.unreadCount, snapshot.previousUnread)
  }
}

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
      const snapshot = snapshotNotifications(qc)
      const now = new Date().toISOString()

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

      if (snapshot.previousUnread) {
        const wasAlreadyRead = snapshot.previousLists.some(([, data]) =>
          data?.notifications.find((n: Notification) => n.id === id)?.is_read,
        )
        if (!wasAlreadyRead) {
          qc.setQueryData<{ count: number }>(queryKeys.notifications.unreadCount, {
            count: Math.max(0, snapshot.previousUnread.count - 1),
          })
        }
      }

      return snapshot
    },
    onError: (_err, _id, context) => rollbackNotifications(qc, context),
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
      const snapshot = snapshotNotifications(qc)
      const now = new Date().toISOString()

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

      qc.setQueryData<{ count: number }>(queryKeys.notifications.unreadCount, { count: 0 })

      return snapshot
    },
    onError: (_err, _vars, context) => rollbackNotifications(qc, context),
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
      const snapshot = snapshotNotifications(qc)

      let wasUnread = false
      for (const [, data] of snapshot.previousLists) {
        const found = data?.notifications.find((n: Notification) => n.id === id)
        if (found) {
          wasUnread = !found.is_read
          break
        }
      }

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

      if (wasUnread && snapshot.previousUnread) {
        qc.setQueryData<{ count: number }>(queryKeys.notifications.unreadCount, {
          count: Math.max(0, snapshot.previousUnread.count - 1),
        })
      }

      return snapshot
    },
    onError: (_err, _id, context) => rollbackNotifications(qc, context),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}
