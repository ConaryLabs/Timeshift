import { useState } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useStaffing } from '@/hooks/queries'
import { cn } from '@/lib/utils'
import type { AssignmentView } from '@/api/schedule'

function getWeekRange(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 0 })
  const end = addDays(start, 6)
  return { start, end }
}

function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? 'text-gray-900' : 'text-white'
}

export default function SchedulePage() {
  const [anchor, setAnchor] = useState(() => new Date())
  const { start, end } = getWeekRange(anchor)
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')

  const { data, isLoading, error } = useStaffing(startStr, endStr)

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  function byDate(date: Date) {
    const key = format(date, 'yyyy-MM-dd')
    return (data ?? []).filter((a) => a.date === key)
  }

  const hasAssignments = (data ?? []).length > 0

  return (
    <div>
      <PageHeader
        title="Schedule"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAnchor((d) => addDays(d, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">
              {format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}
            </span>
            <Button variant="outline" size="sm" onClick={() => setAnchor((d) => addDays(d, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
              Today
            </Button>
          </div>
        }
      />

      {isLoading && <LoadingState />}
      {error && <p className="text-sm text-destructive">Failed to load schedule</p>}

      {!isLoading && !error && !hasAssignments && (
        <EmptyState title="No shifts scheduled" description="No assignments found for this week." />
      )}

      {!isLoading && !error && hasAssignments && (
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => (
            <div key={day.toISOString()} className="bg-card border rounded-lg p-2 min-h-[120px]">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {format(day, 'EEE')}
                <span className="block text-lg text-foreground">{format(day, 'd')}</span>
              </div>
              {byDate(day).map((a) => (
                <AssignmentChip key={a.assignment_id} assignment={a} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AssignmentChip({ assignment: a }: { assignment: AssignmentView }) {
  const textClass = contrastText(a.shift_color)
  return (
    <div
      title={`${a.first_name} ${a.last_name}${a.position ? ` — ${a.position}` : ''}${a.is_overtime ? ' (OT)' : ''}${a.is_trade ? ' (Trade)' : ''}`}
      className={cn(
        "rounded px-1.5 py-0.5 text-xs mb-1 cursor-default",
        textClass,
        a.is_overtime && "border-l-3 border-amber-400",
      )}
      style={{ backgroundColor: a.shift_color }}
    >
      {a.last_name}, {a.first_name?.[0] ?? ''}
      <span className="opacity-75 ml-1">{a.shift_name}</span>
    </div>
  )
}
