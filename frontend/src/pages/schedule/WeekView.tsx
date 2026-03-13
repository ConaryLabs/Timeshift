// frontend/src/pages/schedule/WeekView.tsx
import { useState, useEffect } from 'react'
import { startOfWeek, endOfWeek, addDays, isSameDay, isToday } from 'date-fns'
import { useScheduleGrid, useMySchedule } from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { toLocalDateStr, DAY_LABELS } from '@/lib/format'
import { deriveCoverageStatus, STATUS_COLORS } from './types'
import { DailyView } from './DailyView'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { GridCell } from '@/api/schedule'

interface WeekViewProps {
  date: Date
  onDateChange: (date: Date) => void
  teamId?: string | null
}

export function WeekView({ date, onDateChange: _onDateChange, teamId }: WeekViewProps) {
  const { isManager } = usePermissions()

  const weekStart = startOfWeek(date, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 })

  const weekStartStr = toLocalDateStr(weekStart)
  const weekEndStr = toLocalDateStr(weekEnd)

  const { data: gridCells } = useScheduleGrid(weekStartStr, weekEndStr, teamId ?? undefined)
  const { data: mySchedule } = useMySchedule(weekStartStr, weekEndStr)

  // Default selectedDay to date prop if within week, else today if within week, else weekStart
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const today = new Date()
    const todayStr = toLocalDateStr(today)
    if (todayStr >= weekStartStr && todayStr <= weekEndStr) return today
    return date
  })

  // Keep selectedDay in sync when date prop changes (e.g., navigating to a different week)
  useEffect(() => {
    const selStr = toLocalDateStr(selectedDay)
    if (selStr < weekStartStr || selStr > weekEndStr) {
      // Selected day is outside new week — move to date prop or today if in range
      const today = new Date()
      const todayStr = toLocalDateStr(today)
      const next = todayStr >= weekStartStr && todayStr <= weekEndStr ? today : date
      setSelectedDay(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartStr, weekEndStr])

  // Build per-day coverage summary from grid cells
  function getDayCoverage(dayStr: string): {
    status: 'red' | 'yellow' | 'green'
    totalGap: number
  } {
    const dayCells: GridCell[] = (gridCells ?? []).filter((c) => c.date === dayStr)
    if (dayCells.length === 0) return { status: 'green', totalGap: 0 }

    let worstStatus: 'red' | 'yellow' | 'green' = 'green'
    let totalGap = 0

    for (const cell of dayCells) {
      const status = deriveCoverageStatus(cell.coverage_actual, cell.coverage_required)
      if (status === 'red') worstStatus = 'red'
      else if (status === 'yellow' && worstStatus !== 'red') worstStatus = 'yellow'
      totalGap += Math.max(0, cell.coverage_required - cell.coverage_actual)
    }

    return { status: worstStatus, totalGap }
  }

  // Check if the employee has a shift on a given day
  function employeeHasShift(dayStr: string): boolean {
    if (!mySchedule) return false
    return mySchedule.some((entry) => entry.date === dayStr)
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="space-y-4">
      {/* 7-day heatmap strip */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayStr = toLocalDateStr(day)
          const { status, totalGap } = getDayCoverage(dayStr)
          const colors = STATUS_COLORS[status]
          const isSelected = isSameDay(day, selectedDay)
          const isTodayDay = isToday(day)
          const hasShift = !isManager && employeeHasShift(dayStr)

          return (
            <button
              key={dayStr}
              onClick={() => {
                setSelectedDay(day)
              }}
              className={cn(
                'relative flex flex-col items-center rounded-lg border px-1 py-2 text-center transition-colors hover:opacity-90',
                colors.bg,
                colors.border,
                isSelected && 'ring-2 ring-primary',
              )}
            >
              {/* Day abbreviation */}
              <span className={cn('text-xs font-medium', colors.text)}>
                {DAY_LABELS[day.getDay()]}
              </span>

              {/* Date number */}
              <span
                className={cn(
                  'text-base leading-tight',
                  colors.text,
                  isTodayDay && 'font-bold',
                )}
              >
                {day.getDate()}
              </span>

              {/* Gap badge — only show when there are gaps */}
              {totalGap > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    'mt-1 h-4 min-w-4 px-1 text-[10px] leading-none',
                    colors.text,
                    colors.border,
                    colors.bgDark,
                  )}
                >
                  -{totalGap}
                </Badge>
              )}

              {/* Employee shift indicator */}
              {!isManager && (
                <div className="mt-1">
                  {hasShift ? (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  ) : (
                    <div className="h-2 w-2 rounded-full border border-muted-foreground/40" />
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Daily drill-down */}
      <DailyView date={selectedDay} teamId={teamId} />
    </div>
  )
}
