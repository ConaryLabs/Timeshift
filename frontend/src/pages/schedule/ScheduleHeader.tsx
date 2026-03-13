// frontend/src/pages/schedule/ScheduleHeader.tsx
import { useState } from 'react'
import { format, addDays, addMonths, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Printer, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { type CalendarView } from './types'
import { toLocalDateStr } from '@/lib/format'
import { useTeams, useAnnotations, useCreateAnnotation } from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { useUIStore } from '@/store/ui'
import { SavedFilterBar } from '@/components/SavedFilterBar'
import { AnnotationBadge } from '@/components/AnnotationBadge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ScheduleHeaderProps {
  date: Date
  view: CalendarView
  onDateChange: (date: Date) => void
  onViewChange: (view: CalendarView) => void
}

function formatDateLabel(date: Date, view: CalendarView): string {
  if (view === 'day') {
    return format(date, 'EEEE, MMMM d, yyyy')
  }
  if (view === 'week') {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 })
    return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`
  }
  // month
  return format(date, 'MMMM yyyy')
}

function stepDate(date: Date, view: CalendarView, direction: 1 | -1): Date {
  if (view === 'day') return addDays(date, direction)
  if (view === 'week') return addDays(date, 7 * direction)
  return addMonths(date, direction)
}

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const ANNOTATION_TYPES = [
  { value: 'note', label: 'Note' },
  { value: 'alert', label: 'Alert' },
  { value: 'holiday', label: 'Holiday' },
]

export function ScheduleHeader({ date, view, onDateChange, onViewChange }: ScheduleHeaderProps) {
  const { isManager } = usePermissions()
  const { selectedTeamId, setSelectedTeamId } = useUIStore()
  const { data: teams } = useTeams()

  const dateStr = toLocalDateStr(date)
  const { data: annotations } = useAnnotations(dateStr, dateStr)

  const createAnnotation = useCreateAnnotation()
  const [annotationDialogOpen, setAnnotationDialogOpen] = useState(false)
  const [annotationType, setAnnotationType] = useState('note')
  const [annotationContent, setAnnotationContent] = useState('')

  function handlePrev() {
    onDateChange(stepDate(date, view, -1))
  }

  function handleNext() {
    onDateChange(stepDate(date, view, 1))
  }

  function handleToday() {
    onDateChange(new Date())
  }

  function handleCreateAnnotation() {
    if (!annotationContent.trim()) return
    createAnnotation.mutate(
      {
        date: dateStr,
        content: annotationContent.trim(),
        annotation_type: annotationType,
      },
      {
        onSuccess: () => {
          toast.success('Annotation added')
          setAnnotationDialogOpen(false)
          setAnnotationContent('')
          setAnnotationType('note')
        },
        onError: () => toast.error('Failed to add annotation'),
      },
    )
  }

  const activeTeams = teams?.filter((t) => t.is_active) ?? []

  return (
    <div className="space-y-3">
      {/* Top row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: date label */}
        <div className="text-lg font-semibold min-w-[200px]">
          {formatDateLabel(date, view)}
        </div>

        {/* Center: navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Right: view switcher + team filter + print */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex items-center rounded-md border overflow-hidden">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onViewChange(opt.value)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  view === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-accent text-foreground',
                )}
                aria-pressed={view === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Team filter */}
          <Select
            value={selectedTeamId ?? 'all'}
            onValueChange={(v) => setSelectedTeamId(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {activeTeams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Print */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            aria-label="Print schedule"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Annotation section — supervisor/admin only */}
      {isManager && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnnotationDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Annotation
          </Button>

          {annotations && annotations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {annotations.map((a) => (
                <AnnotationBadge
                  key={a.id}
                  type={a.annotation_type}
                  content={a.content}
                  iconSize="h-3.5 w-3.5"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved filter bar */}
      <SavedFilterBar
        page="schedule"
        currentFilters={{ teamId: selectedTeamId, view }}
        onApplyFilter={(filters) => {
          if (typeof filters.teamId === 'string' || filters.teamId === null) {
            setSelectedTeamId(filters.teamId as string | null)
          }
          if (
            filters.view === 'day' ||
            filters.view === 'week' ||
            filters.view === 'month'
          ) {
            onViewChange(filters.view as CalendarView)
          }
        }}
      />

      {/* Create annotation dialog */}
      <Dialog open={annotationDialogOpen} onOpenChange={setAnnotationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Annotation for {format(date, 'MMMM d, yyyy')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="annotation-type">Type</Label>
              <Select value={annotationType} onValueChange={setAnnotationType}>
                <SelectTrigger id="annotation-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOTATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="annotation-content">Content</Label>
              <Textarea
                id="annotation-content"
                value={annotationContent}
                onChange={(e) => setAnnotationContent(e.target.value)}
                placeholder="Enter annotation text..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAnnotationDialogOpen(false)
                setAnnotationContent('')
                setAnnotationType('note')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAnnotation}
              disabled={!annotationContent.trim() || createAnnotation.isPending}
            >
              Add Annotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
