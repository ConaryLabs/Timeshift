import { useMemo, useState } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
import { ChevronLeft, ChevronRight, LayoutGrid, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useStaffing, useTeams } from '@/hooks/queries'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/format'
import { NO_VALUE } from '@/lib/format'
import type { AssignmentView } from '@/api/schedule'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

type ViewMode = 'week' | 'board'

export default function SchedulePage() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const { start, end } = getWeekRange(anchor)
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')

  const currentUserId = useAuthStore((s) => s.user?.id)
  const { selectedTeamId, setSelectedTeamId } = useUIStore()
  const { data: teams } = useTeams()

  const { data, isLoading, error } = useStaffing(
    startStr,
    endStr,
    selectedTeamId ?? undefined,
  )

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  const hasAssignments = (data ?? []).length > 0

  const teamOptions = (teams ?? []).filter((t) => t.is_active)

  return (
    <div>
      <PageHeader
        title="Schedule"
        actions={
          <div className="flex items-center gap-2">
            {/* Team filter */}
            <Select
              value={selectedTeamId ?? NO_VALUE}
              onValueChange={(v) => setSelectedTeamId(v === NO_VALUE ? null : v)}
            >
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VALUE}>All Teams</SelectItem>
                {teamOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View toggle */}
            <div className="flex border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('week')}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-sm',
                  viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Week
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-sm border-l',
                  viewMode === 'board' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Board
              </button>
            </div>

            {/* Week navigation */}
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

      {!isLoading && !error && hasAssignments && viewMode === 'week' && (
        <WeekView data={data ?? []} days={days} currentUserId={currentUserId} />
      )}

      {!isLoading && !error && hasAssignments && viewMode === 'board' && (
        <BoardView data={data ?? []} days={days} currentUserId={currentUserId} />
      )}
    </div>
  )
}

// ── Week view ────────────────────────────────────────────────────────────────

function WeekView({
  data,
  days,
  currentUserId,
}: {
  data: AssignmentView[]
  days: Date[]
  currentUserId: string | undefined
}) {
  function byDate(date: Date) {
    const key = format(date, 'yyyy-MM-dd')
    return data.filter((a) => a.date === key)
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const isToday = dateStr === todayStr
        return (
          <div
            key={day.toISOString()}
            className={cn(
              'bg-card border rounded-lg p-2 min-h-[120px]',
              isToday && 'border-primary/50 bg-primary/5',
            )}
          >
            <div className={cn('text-xs font-medium mb-1', isToday ? 'text-primary' : 'text-muted-foreground')}>
              {DAY_LABELS[day.getDay()]}
              <span className={cn('block text-lg', isToday ? 'text-primary font-semibold' : 'text-foreground')}>
                {format(day, 'd')}
              </span>
            </div>
            {byDate(day).map((a) => (
              <AssignmentChip key={a.assignment_id} assignment={a} isOwn={a.user_id === currentUserId} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Board view ───────────────────────────────────────────────────────────────

function BoardView({
  data,
  days,
  currentUserId,
}: {
  data: AssignmentView[]
  days: Date[]
  currentUserId: string | undefined
}) {
  // Unique shift templates in start_time order, deduped by shift_name
  const uniqueShifts = useMemo(() => {
    const seen = new Set<string>()
    const result: { name: string; color: string; start_time: string; end_time: string }[] = []
    for (const a of data) {
      if (!seen.has(a.shift_name)) {
        seen.add(a.shift_name)
        result.push({
          name: a.shift_name,
          color: a.shift_color,
          start_time: a.start_time,
          end_time: a.end_time,
        })
      }
    }
    return result.sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [data])

  function cellAssignments(shiftName: string, date: Date) {
    const key = format(date, 'yyyy-MM-dd')
    return data.filter((a) => a.shift_name === shiftName && a.date === key)
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 text-muted-foreground font-medium border-b w-[120px]">Shift</th>
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const isToday = dateStr === todayStr
              return (
                <th
                  key={dateStr}
                  className={cn(
                    'p-2 text-center border-b font-medium',
                    isToday ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <div>{DAY_LABELS[day.getDay()]}</div>
                  <div className={cn('text-lg', isToday && 'font-semibold')}>{format(day, 'd')}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {uniqueShifts.map((shift) => (
            <tr key={shift.name} className="border-b last:border-b-0">
              <td className="p-2 align-top">
                <div
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: shift.color, color: contrastText(shift.color) === 'text-gray-900' ? '#111' : '#fff' }}
                >
                  {shift.name}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
                </div>
              </td>
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const assignments = cellAssignments(shift.name, day)
                const isToday = dateStr === todayStr
                return (
                  <td
                    key={dateStr}
                    className={cn('p-1 align-top min-w-[90px]', isToday && 'bg-primary/5')}
                  >
                    {assignments.length === 0 ? (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {assignments.map((a) => (
                          <AssignmentChip
                            key={a.assignment_id}
                            assignment={a}
                            isOwn={a.user_id === currentUserId}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared chip ──────────────────────────────────────────────────────────────

function AssignmentChip({
  assignment: a,
  isOwn,
}: {
  assignment: AssignmentView
  isOwn: boolean
}) {
  const textClass = contrastText(a.shift_color)
  const tooltipParts = [
    `${a.first_name} ${a.last_name}`,
    a.classification_abbreviation,
    a.position,
    a.is_overtime ? 'OT' : null,
    a.is_trade ? 'Trade' : null,
    a.crosses_midnight ? 'Crosses midnight' : null,
    a.notes,
  ].filter(Boolean)

  return (
    <div
      title={tooltipParts.join(' · ')}
      className={cn(
        'rounded px-1.5 py-0.5 text-xs mb-0.5 cursor-default flex items-center gap-1',
        textClass,
        isOwn && 'ring-2 ring-offset-1 ring-white/80 font-semibold',
      )}
      style={{ backgroundColor: a.shift_color }}
    >
      <span className="truncate">
        {a.last_name}, {a.first_name?.[0] ?? ''}
        {a.classification_abbreviation && (
          <span className="opacity-70 ml-1 text-[10px]">{a.classification_abbreviation}</span>
        )}
      </span>
      {a.is_overtime && <span className="shrink-0 opacity-90 text-[10px] font-bold">OT</span>}
      {a.crosses_midnight && <span className="shrink-0 opacity-80 text-[10px]">→</span>}
    </div>
  )
}
