import { useParams, useNavigate } from 'react-router-dom'
import { format, addDays, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, AlertTriangle, MessageSquare, Star, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDayView, useAnnotations } from '@/hooks/queries'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/format'

function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#111' : '#fff'
}

export default function DayViewPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const dateStr = date ?? format(new Date(), 'yyyy-MM-dd')

  const { data: entries, isLoading, error } = useDayView(dateStr)
  const { data: annotations } = useAnnotations(dateStr, dateStr)

  const parsedDate = parseISO(dateStr)

  function goTo(offset: number) {
    const newDate = addDays(parsedDate, offset)
    navigate(`/schedule/day/${format(newDate, 'yyyy-MM-dd')}`)
  }

  return (
    <div>
      <PageHeader
        title="Day View"
        description={format(parsedDate, 'EEEE, MMMM d, yyyy')}
        actions={
          <div className="flex items-center gap-2">
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
                <CoverageIndicator
                  actual={entry.coverage_actual}
                  required={entry.coverage_required}
                  status={entry.coverage_status}
                />
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
                      const badge = (
                        <span
                          key={a.assignment_id}
                          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium shrink-0"
                          style={{
                            backgroundColor: entry.shift_color,
                            color: contrastText(entry.shift_color),
                          }}
                        >
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
    </div>
  )
}

function CoverageIndicator({
  actual,
  required,
  status,
}: {
  actual: number
  required: number
  status: string
}) {
  if (required === 0 && actual === 0) {
    return (
      <span className="text-xs text-muted-foreground">No requirement</span>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium',
        status === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        status === 'yellow' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        status === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      )}
    >
      {status === 'red' && <AlertTriangle className="h-3.5 w-3.5" />}
      <span>
        {actual}/{required}
      </span>
    </div>
  )
}
