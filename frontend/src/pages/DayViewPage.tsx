import { useState } from 'react'
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom'
import { format, addDays, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, AlertTriangle, MessageSquare, Star, StickyNote, Phone, Clock, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDayView, useAnnotations, useCreateAnnotation } from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { formatTime, contrastText } from '@/lib/format'
import type { ClassificationCoverageDetail } from '@/api/schedule'

export default function DayViewPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { isManager } = usePermissions()

  // Validate date param — use today as fallback for invalid dates
  const isValidDate = !date || !isNaN(parseISO(date).getTime())
  const dateStr = (isValidDate && date) ? date : format(new Date(), 'yyyy-MM-dd')

  const { data: entries, isLoading, error } = useDayView(dateStr)
  const { data: annotations } = useAnnotations(dateStr, dateStr)

  const [annotationOpen, setAnnotationOpen] = useState(false)
  const [annotationType, setAnnotationType] = useState<string>('note')
  const [annotationContent, setAnnotationContent] = useState('')
  const createAnnotation = useCreateAnnotation()

  // Redirect after hooks if the date param is invalid
  if (!isValidDate) {
    return <Navigate to="/schedule" replace />
  }

  const parsedDate = parseISO(dateStr)

  function goTo(offset: number) {
    const newDate = addDays(parsedDate, offset)
    navigate(`/schedule/day/${format(newDate, 'yyyy-MM-dd')}`)
  }

  function handleCreateAnnotation() {
    if (!annotationContent.trim()) return
    createAnnotation.mutate(
      { date: dateStr, annotation_type: annotationType, content: annotationContent.trim() },
      {
        onSuccess: () => {
          setAnnotationOpen(false)
          setAnnotationContent('')
          setAnnotationType('note')
        },
        onError: (err: unknown) => {
          const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
          toast.error(message || 'Failed to save annotation')
        },
      },
    )
  }

  return (
    <div>
      <PageHeader
        title="Day View"
        description={format(parsedDate, 'EEEE, MMMM d, yyyy')}
        actions={
          <div className="flex flex-wrap items-center gap-2 gap-y-2">
            {isManager && (
              <>
                <Button variant="outline" size="sm" onClick={() => setAnnotationOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Annotation
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/available-ot">
                    <Clock className="h-4 w-4 mr-1" />
                    Available OT
                  </Link>
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => goTo(-1)} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Go to today"
              onClick={() =>
                navigate(`/schedule/day/${format(new Date(), 'yyyy-MM-dd')}`)
              }
            >
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => goTo(1)} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Annotations for the day */}
      {annotations && annotations.length > 0 && (
        <div className="mb-4 space-y-1">
          {annotations.map((ann) => (
            <div
              key={ann.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm',
                ann.annotation_type === 'alert' && 'bg-destructive/10 text-destructive',
                ann.annotation_type === 'holiday' && 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                ann.annotation_type === 'note' && 'bg-muted',
              )}
            >
              {ann.annotation_type === 'alert' && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              {ann.annotation_type === 'holiday' && <Star className="h-3.5 w-3.5 shrink-0" />}
              {ann.annotation_type === 'note' && <MessageSquare className="h-3.5 w-3.5 shrink-0" />}
              <span>{ann.content}</span>
            </div>
          ))}
        </div>
      )}

      {isLoading && <LoadingState />}
      {error && <p className="text-sm text-destructive">Failed to load day view</p>}

      {!isLoading && !error && entries && entries.length === 0 && (
        <EmptyState title="No shifts" description="No shift templates configured." />
      )}

      {!isLoading && !error && entries && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.shift_template_id} className="border rounded-lg overflow-hidden">
              {/* Shift header bar */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-card border-b">
                <div
                  className="w-3 h-10 rounded shrink-0"
                  style={{ backgroundColor: entry.shift_color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.shift_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                      {entry.crosses_midnight && (
                        <span className="ml-1 text-xs opacity-70">(+1)</span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isManager && entry.coverage_status === 'red' ? (
                    <button
                      className="cursor-pointer"
                      onClick={() => navigate(`/staffing/resolve?date=${dateStr}`)}
                    >
                      <CoverageIndicator
                        actual={entry.coverage_actual}
                        required={entry.coverage_required}
                        status={entry.coverage_status}
                        byClassification={entry.coverage_by_classification}
                      />
                    </button>
                  ) : (
                    <CoverageIndicator
                      actual={entry.coverage_actual}
                      required={entry.coverage_required}
                      status={entry.coverage_status}
                      byClassification={entry.coverage_by_classification}
                    />
                  )}
                  {isManager && entry.coverage_status === 'red' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => navigate(`/staffing/resolve?date=${dateStr}`)}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Resolve
                    </Button>
                  )}
                </div>
              </div>

              {/* Timeline bar (Gantt-style) */}
              <div className="relative px-4 py-3 bg-muted/30">
                {/* Timeline track */}
                <div className="h-8 rounded bg-muted relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 rounded"
                    style={{
                      backgroundColor: entry.shift_color + '33',
                      left: '0%',
                      right: '0%',
                    }}
                  />
                  <div className="absolute inset-0 flex items-center px-2 gap-1">
                    {entry.assignments.map((a) => {
                      const badgeContent = (
                        <>
                          {a.last_name}, {a.first_name?.[0] ?? ''}
                          {a.classification_abbreviation && (
                            <span className="opacity-70 text-[10px] ml-0.5">
                              {a.classification_abbreviation}
                            </span>
                          )}
                          {a.is_overtime && (
                            <span className="font-bold text-[10px] ml-0.5">OT</span>
                          )}
                          {a.notes && <StickyNote className="h-2.5 w-2.5 ml-0.5 opacity-70" />}
                        </>
                      )
                      const badgeClassName = "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium shrink-0 transition-shadow"
                      const badgeStyle = {
                        backgroundColor: entry.shift_color,
                        color: contrastText(entry.shift_color),
                      }
                      const badge = isManager ? (
                        <Link
                          key={a.assignment_id}
                          to={`/admin/users/${a.user_id}`}
                          className={`${badgeClassName} hover:ring-2 hover:ring-white/50`}
                          style={badgeStyle}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {badgeContent}
                        </Link>
                      ) : (
                        <span
                          key={a.assignment_id}
                          className={badgeClassName}
                          style={badgeStyle}
                        >
                          {badgeContent}
                        </span>
                      )
                      return a.notes ? (
                        <Tooltip key={a.assignment_id}>
                          <TooltipTrigger asChild>{badge}</TooltipTrigger>
                          <TooltipContent>{a.notes}</TooltipContent>
                        </Tooltip>
                      ) : badge
                    })}
                    {entry.assignments.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">
                        No assignments
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Annotation dialog (manager-only) */}
      <Dialog open={annotationOpen} onOpenChange={setAnnotationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Annotation</DialogTitle>
            <DialogDescription>
              Add a note, alert, or holiday marker for {format(parsedDate, 'MMM d, yyyy')}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="annotation-type">Type</Label>
              <Select value={annotationType} onValueChange={setAnnotationType}>
                <SelectTrigger className="w-full" id="annotation-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="annotation-content">Message</Label>
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
            <Button variant="outline" onClick={() => setAnnotationOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateAnnotation}
              disabled={!annotationContent.trim() || createAnnotation.isPending}
            >
              {createAnnotation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CoverageIndicator({
  actual,
  required,
  status,
  byClassification,
}: {
  actual: number
  required: number
  status: string
  byClassification?: ClassificationCoverageDetail[]
}) {
  if (required === 0 && actual === 0) {
    return (
      <span className="text-xs text-muted-foreground">No requirement</span>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium',
          status === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          status === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        )}
      >
        {status === 'red' && <AlertTriangle className="h-3.5 w-3.5" />}
        <span>
          {actual}/{required}
        </span>
      </div>
      {byClassification && byClassification.length > 0 && (
        <div className="flex items-center gap-1">
          {byClassification.map((c) => (
            <span
              key={c.classification_abbreviation}
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            >
              {c.classification_abbreviation} −{c.shortage}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
