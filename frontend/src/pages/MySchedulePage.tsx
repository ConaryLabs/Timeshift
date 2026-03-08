// frontend/src/pages/MySchedulePage.tsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  CalendarOff,
  ArrowLeftRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMySchedule, useMyPreferences } from '@/hooks/queries'
import { cn } from '@/lib/utils'
import { formatDateShort, formatDateFull, formatTime, toLocalDateStr, DAY_LABELS } from '@/lib/format'
import type { MyScheduleEntry } from '@/api/employee'

type ViewMode = 'week' | 'month'

function getWeekStart(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function getMonthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export default function MySchedulePage() {
  const nav = useNavigate()
  const { data: prefs } = useMyPreferences()
  const defaultView = (prefs?.preferred_view === 'month' ? 'month' : 'week') as ViewMode
  const [view, setView] = useState<ViewMode | null>(null)
  const activeView = view ?? defaultView

  const [anchor, setAnchor] = useState(() => new Date())

  const { startDate, endDate, displayDays } = useMemo(() => {
    if (activeView === 'week') {
      const start = getWeekStart(anchor)
      const end = addDays(start, 6)
      const days: Date[] = []
      for (let i = 0; i < 7; i++) days.push(addDays(start, i))
      return { startDate: toLocalDateStr(start), endDate: toLocalDateStr(end), displayDays: days }
    } else {
      const monthStart = getMonthStart(anchor)
      const calStart = getWeekStart(monthStart)
      const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
      const calEnd = addDays(getWeekStart(addDays(monthEnd, 6)), 6)
      const days: Date[] = []
      let d = calStart
      while (d <= calEnd) {
        days.push(d)
        d = addDays(d, 1)
      }
      return { startDate: toLocalDateStr(calStart), endDate: toLocalDateStr(calEnd), displayDays: days }
    }
  }, [anchor, activeView])

  const { data: entries, isLoading, isError } = useMySchedule(startDate, endDate)

  const entryMap = useMemo(() => {
    const map = new Map<string, MyScheduleEntry[]>()
    if (entries) {
      for (const e of entries) {
        const key = e.date
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(e)
      }
    }
    return map
  }, [entries])

  function navigate(dir: -1 | 1) {
    setAnchor((prev) => {
      if (activeView === 'week') {
        return addDays(prev, dir * 7)
      } else {
        return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
      }
    })
  }

  function goToday() {
    setAnchor(new Date())
  }

  const todayStr = toLocalDateStr(new Date())

  const headerLabel = activeView === 'week'
    ? `${formatDateShort(startDate)} - ${formatDateFull(endDate)}`
    : anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="My Schedule"
        description="Your personal shift calendar"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border">
              <Button
                variant={activeView === 'week' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setView('week')}
              >
                Week
              </Button>
              <Button
                variant={activeView === 'month' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setView('month')}
              >
                Month
              </Button>
            </div>
          </div>
        }
      />

      {/* Navigation bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold">{headerLabel}</h2>
      </div>

      {isLoading && <LoadingState />}
      {!isLoading && isError && (
        <ErrorState message="Failed to load schedule data." />
      )}

      {!isLoading && !isError && entries && entries.length === 0 && (
        <EmptyState
          title="No shifts scheduled"
          description="You don't have any shifts scheduled for this period."
        />
      )}

      {!isLoading && !isError && activeView === 'week' && (entries?.length ?? 0) > 0 && (
        <WeekView days={displayDays} entryMap={entryMap} todayStr={todayStr} onNavigate={nav} />
      )}

      {!isLoading && !isError && activeView === 'month' && (entries?.length ?? 0) > 0 && (
        <MonthView
          days={displayDays}
          entryMap={entryMap}
          todayStr={todayStr}
          currentMonth={anchor.getMonth()}
          onNavigate={nav}
        />
      )}
    </div>
  )
}

function DayActionMenu({ dateStr, hasShift, onNavigate }: { dateStr: string; hasShift: boolean; onNavigate: (path: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" aria-label="Day actions">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => onNavigate(`/leave?date=${dateStr}`)}>
          <CalendarOff className="h-3.5 w-3.5 mr-2" />
          Request Leave
        </DropdownMenuItem>
        {hasShift && (
          <DropdownMenuItem onClick={() => onNavigate(`/trades?date=${dateStr}`)}>
            <ArrowLeftRight className="h-3.5 w-3.5 mr-2" />
            Propose Trade
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function WeekView({
  days,
  entryMap,
  todayStr,
  onNavigate,
}: {
  days: Date[]
  entryMap: Map<string, MyScheduleEntry[]>
  todayStr: string
  onNavigate: (path: string) => void
}) {
  return (
    <div className="overflow-x-auto">
    <div className="grid grid-cols-7 gap-3 min-w-[640px]">
      {days.map((day) => {
        const dateStr = toLocalDateStr(day)
        const shifts = entryMap.get(dateStr) ?? []
        const isToday = dateStr === todayStr

        return (
          <div key={dateStr}>
            <div
              className={cn(
                'text-center mb-2 py-1 rounded-md text-sm font-medium relative',
                isToday
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <div className="text-xs">{DAY_LABELS[day.getDay()]}</div>
              <div className="text-lg">{day.getDate()}</div>
              <div className="absolute top-1 right-1">
                <DayActionMenu dateStr={dateStr} hasShift={shifts.length > 0} onNavigate={onNavigate} />
              </div>
            </div>

            <div className="space-y-2 min-h-[100px]">
              {shifts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center pt-4">Off</p>
              )}
              {shifts.map((entry, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: entry.shift_color }} />
                  <CardContent className="p-2">
                    <p className="font-medium text-xs truncate">{entry.shift_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                    </p>
                    {entry.team_name && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {entry.team_name}
                      </p>
                    )}
                    {entry.position && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {entry.position}
                      </p>
                    )}
                    {(entry.is_overtime || entry.is_trade) && (
                      <div className="flex gap-1 mt-1">
                        {entry.is_overtime && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">OT</Badge>
                        )}
                        {entry.is_trade && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">Trade</Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
    </div>
  )
}

function MonthView({
  days,
  entryMap,
  todayStr,
  currentMonth,
  onNavigate,
}: {
  days: Date[]
  entryMap: Map<string, MyScheduleEntry[]>
  todayStr: string
  currentMonth: number
  onNavigate: (path: string) => void
}) {
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((day) => {
            const dateStr = toLocalDateStr(day)
            const shifts = entryMap.get(dateStr) ?? []
            const isToday = dateStr === todayStr
            const isCurrentMonth = day.getMonth() === currentMonth

            return (
              <div
                key={dateStr}
                className={cn(
                  'group min-h-[80px] p-1 border-r last:border-r-0',
                  !isCurrentMonth && 'bg-muted/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'text-xs w-6 h-6 flex items-center justify-center rounded-full',
                      isToday && 'bg-primary text-primary-foreground',
                      !isToday && !isCurrentMonth && 'text-muted-foreground/50',
                      !isToday && isCurrentMonth && 'text-muted-foreground',
                    )}
                  >
                    {day.getDate()}
                  </div>
                  <div className="sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <DayActionMenu dateStr={dateStr} hasShift={shifts.length > 0} onNavigate={onNavigate} />
                  </div>
                </div>

                <div className="space-y-0.5 mt-0.5">
                  {shifts.map((entry, i) => (
                    <div
                      key={i}
                      className="text-[10px] px-1 py-0.5 rounded truncate text-white font-medium"
                      style={{ backgroundColor: entry.shift_color }}
                      title={`${entry.shift_name} ${formatTime(entry.start_time)}-${formatTime(entry.end_time)}`}
                    >
                      {entry.shift_name}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
