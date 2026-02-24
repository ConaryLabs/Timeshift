import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Bell,
  Calendar,
  ArrowRightLeft,
  Clock,
  AlertCircle,
  Phone,
  CheckCheck,
  Trash2,
  MoreHorizontal,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '@/hooks/queries'
import { cn } from '@/lib/utils'
import type { Notification, NotificationType } from '@/api/notifications'

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function notificationIcon(type: NotificationType) {
  switch (type) {
    case 'leave_reviewed':
      return <Calendar className="h-4 w-4" />
    case 'trade_requested':
    case 'trade_reviewed':
      return <ArrowRightLeft className="h-4 w-4" />
    case 'ot_assigned':
    case 'ot_assignment_cancelled':
      return <Clock className="h-4 w-4" />
    case 'callout_created':
      return <Phone className="h-4 w-4" />
    case 'shift_changed':
      return <AlertCircle className="h-4 w-4" />
    default:
      return <Bell className="h-4 w-4" />
  }
}

function notificationIconColor(type: NotificationType) {
  switch (type) {
    case 'leave_reviewed':
      return 'text-blue-500 bg-blue-500/10'
    case 'trade_requested':
    case 'trade_reviewed':
      return 'text-purple-500 bg-purple-500/10'
    case 'ot_assigned':
    case 'ot_assignment_cancelled':
      return 'text-amber-500 bg-amber-500/10'
    case 'callout_created':
      return 'text-red-500 bg-red-500/10'
    case 'shift_changed':
      return 'text-orange-500 bg-orange-500/10'
    default:
      return 'text-muted-foreground bg-muted'
  }
}

function NotificationRow({ notification }: { notification: Notification }) {
  const navigate = useNavigate()
  const markRead = useMarkNotificationRead()
  const deleteMut = useDeleteNotification()

  function handleClick() {
    if (!notification.is_read) {
      markRead.mutate(notification.id)
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  function handleMarkRead(e: React.MouseEvent) {
    e.stopPropagation()
    markRead.mutate(notification.id, {
      onError: () => toast.error('Failed to mark as read'),
    })
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    deleteMut.mutate(notification.id, {
      onSuccess: () => toast.success('Notification deleted'),
      onError: () => toast.error('Failed to delete notification'),
    })
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group flex items-start gap-3 px-4 py-3 transition-colors border-b last:border-b-0',
        notification.link && 'cursor-pointer',
        !notification.is_read
          ? 'bg-primary/[0.03] border-l-2 border-l-primary'
          : 'border-l-2 border-l-transparent hover:bg-muted/50',
      )}
    >
      <div className={cn(
        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        notificationIconColor(notification.notification_type),
      )}>
        {notificationIcon(notification.notification_type)}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn(
          'text-sm leading-snug',
          !notification.is_read ? 'font-semibold text-foreground' : 'text-foreground',
        )}>
          {notification.title}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {timeAgo(notification.created_at)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.is_read && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleMarkRead}
            title="Mark as read"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!notification.is_read && (
              <DropdownMenuItem onClick={handleMarkRead}>
                <Check className="h-4 w-4" />
                Mark as read
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDelete} variant="destructive">
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!notification.is_read && (
        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </div>
  )
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const params = filter === 'unread' ? { unread_only: true } : undefined
  const { data, isLoading, isError } = useNotifications(params)
  const markAllRead = useMarkAllNotificationsRead()

  function handleMarkAllRead() {
    markAllRead.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(`Marked ${result.updated} notification${result.updated === 1 ? '' : 's'} as read`)
      },
      onError: () => toast.error('Failed to mark all as read'),
    })
  }

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unread_count ?? 0

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 rounded-lg border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Failed to load notifications.
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-10 w-10" />}
            title="No notifications"
            description={filter === 'unread' ? "You're all caught up!" : 'Notifications will appear here when there are updates.'}
          />
        ) : (
          notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))
        )}
      </div>
    </div>
  )
}
