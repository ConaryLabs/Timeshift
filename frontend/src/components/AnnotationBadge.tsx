// frontend/src/components/AnnotationBadge.tsx
import { AlertTriangle, Star, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnnotationBadgeProps {
  type: string
  content: string
  iconSize?: string
  className?: string
}

const ANNOTATION_STYLES: Record<string, string> = {
  alert: 'bg-destructive/10 text-destructive',
  holiday: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  note: 'bg-muted',
}

const ANNOTATION_ICONS: Record<string, typeof AlertTriangle> = {
  alert: AlertTriangle,
  holiday: Star,
  note: MessageSquare,
}

export function AnnotationBadge({ type, content, iconSize = 'h-4 w-4', className }: AnnotationBadgeProps) {
  const Icon = ANNOTATION_ICONS[type]

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm',
        ANNOTATION_STYLES[type],
        className,
      )}
    >
      {Icon && <Icon className={cn(iconSize, 'shrink-0')} />}
      <span>{content}</span>
    </div>
  )
}
