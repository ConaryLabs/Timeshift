import { useMemo, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, getDay, getDaysInMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, LayoutGrid, CalendarDays, Calendar as CalendarIcon, Printer, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { SavedFilterBar } from '@/components/SavedFilterBar'
import { useStaffing, useTeams, useScheduleGrid } from '@/hooks/queries'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { formatTime, contrastText as contrastTextHex, NO_VALUE } from '@/lib/format'
import type { AssignmentView, GridCell } from '@/api/schedule'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekRange(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 0 })
  const end = addDays(start, 6)
  return { start, end }
}

function contrastText(hex: string): string {
  return contrastTextHex(hex) === '#111' ? 'text-gray-900' : 'text-white'
}

type ViewMode = 'week' | 'board' | 'month'

export default function SchedulePage() {
  const navigate = useNavigate()
  const [anchor, setAnchor] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const { start, end } = getWeekRange(anchor)
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')

  // Month view range
  const monthStart = startOfMonth(anchor)
  const monthEnd = endOfMonth(anchor)
  const monthStartStr = format(monthStart, 'yyyy-MM-dd')
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd')

  const currentUserId = useAuthStore((s) => s.user?.id)
  const { selectedTeamId, setSelectedTeamId } = useUIStore()
  const { data: teams } = useTeams()

  const { data, isLoading, error, refetch } = useStaffing(
    viewMode === 'month' ? monthStartStr : startStr,
    viewMode === 'month' ? monthEndStr : endStr,
    selectedTeamId ?? undefined,
    { enabled: viewMode !== 'month' },
  )

  // Grid data for month view coverage indicators
  const { data: gridData, isLoading: isMonthLoading, error: gridError } = useScheduleGrid(
    monthStartStr,
    monthEndStr,
    selectedTeamId ?? undefined,
    { enabled: viewMode === 'month' },
  )

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  const hasAssignments = (data ?? []).length > 0

  const teamOptions = (teams ?? []).filter((t) => t.is_active)

  const currentFilters = useMemo(() => ({
    teamId: selectedTeamId ?? null,
    viewMode,
  }), [selectedTeamId, viewMode])

  const handleApplyFilter = useCallback((filters: Record<string, unknown>) => {
    if (filters.teamId !== undefined) {
      setSelectedTeamId((filters.teamId as string) || null)
    }
    if (filters.viewMode !== undefined) {
      setViewMode(filters.viewMode as ViewMode)
    }
  }, [setSelectedTeamId])

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
            <div className="flex border rounded-md overflow-hidden" role="tablist" aria-label="Schedule view">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'week'}
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
                type="button"
                role="tab"
                aria-selected={viewMode === 'board'}
                onClick={() => setViewMode('board')}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-sm border-l',
                  viewMode === 'board' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Board
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'month'}
                onClick={() => setViewMode('month')}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-sm border-l',
                  viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Month
              </button>
            </div>

            {/* Navigation */}
            <Button
              variant="outline"
              size="sm"
              aria-label={viewMode === 'month' ? 'Previous month' : 'Previous week'}
              onClick={() =>
                setAnchor((d) =>
                  viewMode === 'month'
                    ? new Date(d.getFullYear(), d.getMonth() - 1, 1)
                    : addDays(d, -7),
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-sm font-medium min-w-[180px] text-center hover:bg-accent rounded-md px-2 py-1 transition-colors">
                  {viewMode === 'month'
                    ? format(anchor, 'MMMM yyyy')
                    : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={anchor}
                  onSelect={(date) => date && setAnchor(date)}
                  defaultMonth={anchor}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              aria-label={viewMode === 'month' ? 'Next month' : 'Next week'}
              onClick={() =>
                setAnchor((d) =>
                  viewMode === 'month'
                    ? new Date(d.getFullYear(), d.getMonth() + 1, 1)
                    : addDays(d, 7),
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} aria-label="Print schedule">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <SavedFilterBar
        page="schedule"
        currentFilters={currentFilters}
        onApplyFilter={handleApplyFilter}
        className="mb-4"
      />

      {isLoading && <LoadingState />}
      {error && (
        <div className="flex items-center gap-3 text-sm text-destructive">
          <p>Failed to load schedule.</p>
          <button onClick={() => refetch()} className="underline hover:no-underline">Retry</button>
        </div>
      )}

      {!isLoading && !error && !hasAssignments && (
        <EmptyState title="No shifts scheduled for this period" description="Shift templates and team assignments create the schedule." />
      )}

      {!isLoading && !error && hasAssignments && viewMode === 'week' && (
        <WeekView data={data ?? []} days={days} currentUserId={currentUserId} />
      )}

      {!isLoading && !error && hasAssignments && viewMode === 'board' && (
        <BoardView data={data ?? []} days={days} currentUserId={currentUserId} />
      )}

      {viewMode === 'month' && isMonthLoading && <LoadingState />}

      {!isMonthLoading && !gridError && viewMode === 'month' && (
        <MonthView anchor={anchor} gridData={gridData ?? []} navigate={navigate} />
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
  const byDate = useMemo(() => {
    const map = new Map<string, AssignmentView[]>()
    for (const a of data) {
      const arr = map.get(a.date) ?? []
      arr.push(a)
      map.set(a.date, arr)
    }
    return map
  }, [data])

  // TODO: Use org timezone instead of browser timezone for "today" determination
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
            {(byDate.get(dateStr) ?? []).map((a) => (
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

  // Group by "shiftName|date" for O(1) cell lookup
  const cellMap = useMemo(() => {
    const map = new Map<string, AssignmentView[]>()
    for (const a of data) {
      const key = `${a.shift_name}|${a.date}`
      const arr = map.get(key) ?? []
      arr.push(a)
      map.set(key, arr)
    }
    return map
  }, [data])

  // TODO: Use org timezone instead of browser timezone for "today" determination
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
                    'p-2 text-center border-b font-medium min-w-[100px]',
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
                const assignments = cellMap.get(`${shift.name}|${dateStr}`) ?? []
                const isToday = dateStr === todayStr
                return (
                  <td
                    key={dateStr}
                    className={cn('p-1 align-top min-w-[100px]', isToday && 'bg-primary/5')}
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

// ── Month view ──────────────────────────────────────────────────────────────

function MonthView({
  anchor,
  gridData,
  navigate,
}: {
  anchor: Date
  gridData: GridCell[]
  navigate: ReturnType<typeof useNavigate>
}) {
  const monthStart = startOfMonth(anchor)
  const daysInMonth = getDaysInMonth(anchor)
  const startDow = getDay(monthStart)
  // TODO: Use org timezone instead of browser timezone for "today" determination
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // Group grid data by date for quick lookup
  const byDate = useMemo(() => {
    const map = new Map<string, GridCell[]>()
    for (const cell of gridData) {
      const arr = map.get(cell.date) ?? []
      arr.push(cell)
      map.set(cell.date, arr)
    }
    return map
  }, [gridData])

  // Build 6-week grid (42 cells)
  const cells: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), d))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {DAY_LABELS.map((label) => (
          <div key={label} className="bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">
            {label}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="bg-card min-h-[80px]" />
          }
          const dateStr = format(day, 'yyyy-MM-dd')
          const isToday = dateStr === todayStr
          const dayCells = byDate.get(dateStr) ?? []

          // Compute overall coverage status for the day (min-only: green or red)
          let worstStatus: 'none' | 'green' | 'red' = 'none'
          for (const cell of dayCells) {
            if (cell.coverage_required > 0) {
              if (cell.coverage_actual < cell.coverage_required) {
                worstStatus = 'red'
                break
              } else {
                if (worstStatus === 'none') worstStatus = 'green'
              }
            }
          }

          const totalAssignments = dayCells.reduce((sum, c) => sum + c.assignments.length, 0)

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => navigate(`/schedule/day/${dateStr}`)}
              aria-label={`View ${format(day, 'MMMM d')}`}
              className={cn(
                'bg-card min-h-[80px] p-1.5 cursor-pointer hover:bg-accent/50 transition-colors text-left',
                isToday && 'ring-2 ring-inset ring-primary/50',
              )}
            >
              <div className={cn(
                'text-sm font-medium mb-1',
                isToday ? 'text-primary font-semibold' : 'text-foreground',
              )}>
                {format(day, 'd')}
              </div>
              {dayCells.length > 0 && (
                <div className="space-y-0.5">
                  {/* Mini coverage indicators */}
                  <div className="flex flex-wrap gap-0.5">
                    {dayCells.slice(0, 4).map((cell) => {
                      const isUnder = cell.coverage_required > 0 && cell.coverage_actual < cell.coverage_required
                      const status =
                        cell.coverage_required === 0
                          ? 'bg-muted-foreground/30'
                          : cell.coverage_actual >= cell.coverage_required
                            ? 'bg-green-500'
                            : 'bg-red-500'
                      if (isUnder) {
                        const classDetail = cell.coverage_by_classification?.length
                          ? ` (${cell.coverage_by_classification.map((c) => `${c.classification_abbreviation} −${c.shortage}`).join(', ')})`
                          : ''
                        return (
                          <button
                            key={cell.shift_template_id}
                            type="button"
                            title={`${cell.shift_name}: ${cell.coverage_actual}/${cell.coverage_required}${classDetail} — Click to resolve`}
                            className={cn('rounded-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/50', status, 'w-auto h-4 px-1')}
                            onClick={(e) => { e.stopPropagation(); navigate(`/staffing/resolve?date=${dateStr}`) }}
                          >
                            <span className="text-[8px] font-bold text-white leading-none">{cell.coverage_actual}/{cell.coverage_required}</span>
                          </button>
                        )
                      }
                      return (
                        <div
                          key={cell.shift_template_id}
                          title={`${cell.shift_name}: ${cell.coverage_actual}/${cell.coverage_required}`}
                          className={cn('rounded-full flex items-center justify-center', status, 'w-2 h-2')}
                        />
                      )
                    })}
                    {dayCells.length > 4 && (
                      <span className="text-[9px] text-muted-foreground">+{dayCells.length - 4}</span>
                    )}
                  </div>
                  {totalAssignments > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      {totalAssignments} staff
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
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
  const { isAdmin } = usePermissions()
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

  const chipClassName = cn(
    'rounded px-1.5 py-0.5 text-xs mb-0.5 flex items-center gap-1 transition-shadow',
    textClass,
    isOwn && 'ring-2 ring-offset-1 ring-white/80 font-semibold',
    isAdmin && 'hover:ring-1 hover:ring-white/50',
  )

  const chipContent = (
    <>
      <span className="truncate">
        {a.last_name}, {a.first_name?.[0] ?? ''}
        {a.classification_abbreviation && (
          <span className="opacity-70 ml-1 text-[10px]">{a.classification_abbreviation}</span>
        )}
      </span>
      {a.is_overtime && <span className="shrink-0 opacity-90 text-[10px] font-bold">OT</span>}
      {a.crosses_midnight && <span className="shrink-0 opacity-80 text-[10px]">→</span>}
      {a.notes && (
        <Tooltip>
          <TooltipTrigger asChild>
            <StickyNote className="h-3 w-3 shrink-0 opacity-70" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {a.notes}
          </TooltipContent>
        </Tooltip>
      )}
    </>
  )

  if (isAdmin) {
    return (
      <Link
        to={`/admin/users/${a.user_id}`}
        title={tooltipParts.join(' · ')}
        className={chipClassName}
        style={{ backgroundColor: a.shift_color }}
        onClick={(e) => e.stopPropagation()}
      >
        {chipContent}
      </Link>
    )
  }

  return (
    <span
      title={tooltipParts.join(' · ')}
      className={chipClassName}
      style={{ backgroundColor: a.shift_color }}
    >
      {chipContent}
    </span>
  )
}
