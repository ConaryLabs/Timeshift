// frontend/src/pages/schedule/MonthView.tsx
import { useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
} from 'date-fns'
import { useScheduleGrid, useMySchedule } from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { toLocalDateStr, DAY_LABELS } from '@/lib/format'
import { deriveCoverageStatus, STATUS_COLORS } from './types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LoadingState } from '@/components/ui/loading-state'
import type { GridCell } from '@/api/schedule'
import type { MyScheduleEntry } from '@/api/employee'

interface MonthViewProps {
  date: Date
  onDateChange: (date: Date) => void
  teamId?: string | null
}

export function MonthView({ date, onDateChange, teamId }: MonthViewProps) {
  const { isManager, role } = usePermissions()
  const isEmployee = role === 'employee'

  // Compute grid bounds: 6-week range starting on Sunday of the month's first week
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  // Ensure at least 6 full weeks (42 days)
  const minGridEnd = addDays(gridStart, 41)
  const effectiveGridEnd = gridEnd < minGridEnd ? minGridEnd : gridEnd

  const gridStartStr = toLocalDateStr(gridStart)
  const gridEndStr = toLocalDateStr(effectiveGridEnd)

  const { data: gridCells, isLoading: gridLoading } = useScheduleGrid(
    gridStartStr,
    gridEndStr,
    teamId ?? undefined,
  )

  const { data: mySchedule, isLoading: myLoading } = useMySchedule(
    gridStartStr,
    gridEndStr,
  )

  // Build lookup maps
  const cellByDate = useMemo(() => {
    const map = new Map<string, GridCell[]>()
    if (!gridCells) return map
    for (const cell of gridCells) {
      const existing = map.get(cell.date) ?? []
      existing.push(cell)
      map.set(cell.date, existing)
    }
    return map
  }, [gridCells])

  const myScheduleByDate = useMemo(() => {
    const map = new Map<string, MyScheduleEntry>()
    if (!mySchedule) return map
    for (const entry of mySchedule) {
      map.set(entry.date, entry)
    }
    return map
  }, [mySchedule])

  // Build the flat list of days in the grid
  const days = useMemo(() => {
    const result: Date[] = []
    let cur = gridStart
    while (cur <= effectiveGridEnd) {
      result.push(cur)
      cur = addDays(cur, 1)
    }
    return result
  }, [gridStart, effectiveGridEnd])

  const isLoading = gridLoading || (isEmployee && myLoading)

  if (isLoading) {
    return <LoadingState message="Loading calendar…" />
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1">
        {days.map((day) => {
          const dateStr = toLocalDateStr(day)
          const cells = cellByDate.get(dateStr) ?? []
          const myEntry = myScheduleByDate.get(dateStr)
          const inCurrentMonth = isSameMonth(day, date)
          const todayCell = isToday(day)

          // Derive worst coverage status across all shift cells for the day
          const worstStatus = (() => {
            if (cells.length === 0) return null
            let hasRed = false
            let hasYellow = false
            for (const cell of cells) {
              const s = deriveCoverageStatus(
                cell.coverage_actual,
                cell.coverage_required,
              )
              if (s === 'red') { hasRed = true; break }
              if (s === 'yellow') hasYellow = true
            }
            if (hasRed) return 'red' as const
            if (hasYellow) return 'yellow' as const
            return 'green' as const
          })()

          // Total gap across all shifts
          const totalGap = cells.reduce((sum, cell) => {
            const shortage = cell.coverage_required - cell.coverage_actual
            return sum + (shortage > 0 ? shortage : 0)
          }, 0)

          const bgClass =
            worstStatus && inCurrentMonth
              ? STATUS_COLORS[worstStatus].bg
              : ''

          // Build tooltip content for managers: breakdown by classification
          const tooltipLines: string[] = []
          if (isManager && cells.length > 0) {
            for (const cell of cells) {
              if (cell.coverage_by_classification && cell.coverage_by_classification.length > 0) {
                for (const cls of cell.coverage_by_classification) {
                  if (cls.shortage > 0) {
                    tooltipLines.push(
                      `${cell.shift_name} / ${cls.classification_abbreviation}: −${cls.shortage}`,
                    )
                  }
                }
              } else {
                const shortage = cell.coverage_required - cell.coverage_actual
                if (shortage > 0) {
                  tooltipLines.push(`${cell.shift_name}: −${shortage}`)
                }
              }
            }
          }

          const cellContent = (
            <button
              key={dateStr}
              type="button"
              onClick={() => onDateChange(day)}
              className={cn(
                'relative flex flex-col gap-0.5 min-h-[80px] p-1.5 text-left border-b border-r',
                'transition-colors hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary/40',
                bgClass,
                todayCell && 'ring-2 ring-primary/50',
                !inCurrentMonth && 'opacity-40',
              )}
            >
              {/* Date number */}
              <span
                className={cn(
                  'text-sm leading-none',
                  todayCell
                    ? 'font-bold text-primary'
                    : inCurrentMonth
                      ? 'font-semibold text-foreground'
                      : 'font-normal text-muted-foreground',
                )}
              >
                {day.getDate()}
              </span>

              {/* Gap badge */}
              {totalGap > 0 && inCurrentMonth && (
                <Badge
                  variant="destructive"
                  className="text-[10px] leading-none px-1 py-0 h-4 self-start"
                >
                  −{totalGap}
                </Badge>
              )}

              {/* Employee personal shift indicator */}
              {isEmployee && myEntry && (
                <div className="flex items-center gap-1 mt-auto">
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: myEntry.shift_color }}
                    title={myEntry.shift_name}
                  />
                  <span className="text-[10px] text-muted-foreground truncate">
                    {myEntry.shift_name}
                  </span>
                </div>
              )}
            </button>
          )

          // Wrap in tooltip for managers when there are gaps
          if (isManager && tooltipLines.length > 0) {
            return (
              <Tooltip key={dateStr}>
                <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <div className="text-xs space-y-0.5">
                    {tooltipLines.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          }

          return cellContent
        })}
      </div>
    </div>
  )
}
