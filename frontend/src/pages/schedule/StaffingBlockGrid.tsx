// frontend/src/pages/schedule/StaffingBlockGrid.tsx
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Users, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useDayGrid } from '@/hooks/queries'
import { getCurrentBlockIndex } from '@/lib/dutyBoard'
import { cn } from '@/lib/utils'
import { BLOCK_COUNT } from './types'
import type { SelectedBlock } from './types'
import type { ClassificationBlock, DayGridClassification } from '@/api/coveragePlans'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StaffingBlockGridProps {
  date: string              // "YYYY-MM-DD"
  readonly?: boolean        // true for employees — no clicking
  onBlockClick?: (block: SelectedBlock) => void
}

// ---------------------------------------------------------------------------
// Block column descriptors (static — always 12 two-hour blocks)
// ---------------------------------------------------------------------------

const BLOCK_COLUMNS = Array.from({ length: BLOCK_COUNT }, (_, i) => {
  const startH = i * 2
  const endH = (startH + 2) % 24
  const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`
  return { index: i, startTime: fmt(startH), endTime: fmt(endH), label: fmt(startH) }
})

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function StaffingBlockGrid({ date, readonly, onBlockClick }: StaffingBlockGridProps) {
  const { data: dayGrid, isLoading, isError, refetch } = useDayGrid(date)
  const currentBlock = getCurrentBlockIndex()

  const classifications = dayGrid?.classifications ?? []

  function handleBlockClick(cls: DayGridClassification, block: ClassificationBlock) {
    if (readonly) return
    if (block.status === 'green') return
    onBlockClick?.({
      classificationId: cls.classification_id,
      classificationAbbr: cls.abbreviation,
      blockIndex: block.block_index,
      blockStart: block.start_time,
      blockEnd: block.end_time,
      min: block.min,
      actual: block.actual,
    })
  }

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState message="Failed to load coverage data." onRetry={refetch} />

  if (!dayGrid || classifications.length === 0) {
    return (
      <EmptyState
        title="No coverage plan configured"
        description="Set up coverage plans in the admin panel to see coverage data."
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Time header row */}
      <div className="flex border rounded-t-lg overflow-hidden bg-muted/30">
        <div className="w-36 shrink-0 border-r" />
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: `repeat(${BLOCK_COUNT}, 1fr)` }}
        >
          {BLOCK_COLUMNS.map((col) => (
            <div
              key={col.index}
              className={cn(
                'text-[11px] font-medium text-muted-foreground text-center border-r last:border-r-0 px-0.5 py-1.5',
                col.index === currentBlock && 'bg-primary/10 font-bold text-foreground',
              )}
            >
              {col.label}
            </div>
          ))}
        </div>
      </div>

      {/* One collapsible row per classification */}
      {classifications.map((cls) => (
        <ClassificationRow
          key={cls.classification_id}
          classification={cls}
          currentBlock={currentBlock}
          readonly={readonly}
          onBlockClick={(block) => handleBlockClick(cls, block)}
        />
      ))}

      {/* Total summary row */}
      {dayGrid.blocks.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {/* Total min */}
          <div className="flex bg-muted/30">
            <div className="w-36 shrink-0 border-r flex items-center px-2">
              <span className="text-[10px] text-muted-foreground">Total Min</span>
            </div>
            <div
              className="flex-1 grid"
              style={{ gridTemplateColumns: `repeat(${BLOCK_COUNT}, 1fr)` }}
            >
              {BLOCK_COLUMNS.map((col) => {
                const aggBlock = dayGrid.blocks[col.index]
                return (
                  <div
                    key={col.index}
                    className={cn(
                      'border-r last:border-r-0 h-5 flex items-center justify-center text-[10px] tabular-nums text-muted-foreground',
                      col.index === currentBlock && 'bg-primary/10',
                    )}
                  >
                    {aggBlock?.total_target ?? ''}
                  </div>
                )
              })}
            </div>
          </div>
          {/* Total actual */}
          <div className="flex bg-muted/30">
            <div className="w-36 shrink-0 border-r flex items-center px-2">
              <span className="text-[10px] font-bold">Total Actual</span>
            </div>
            <div
              className="flex-1 grid"
              style={{ gridTemplateColumns: `repeat(${BLOCK_COUNT}, 1fr)` }}
            >
              {BLOCK_COLUMNS.map((col) => {
                const aggBlock = dayGrid.blocks[col.index]
                if (!aggBlock) return <div key={col.index} className="border-r last:border-r-0 h-6" />
                return (
                  <div
                    key={col.index}
                    className={cn(
                      'border-r last:border-r-0 h-6 flex items-center justify-center text-xs tabular-nums font-bold',
                      aggBlock.status === 'green' && 'text-green-800 dark:text-green-400',
                      aggBlock.status === 'red' && 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
                      col.index === currentBlock && 'bg-primary/10',
                    )}
                  >
                    {aggBlock.total_actual}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ClassificationRow — collapsible Gantt + coverage summary
// ---------------------------------------------------------------------------

type BarSegment = {
  assignmentId: string
  shiftName: string
  shiftStart: string
  shiftEnd: string
  isOvertime: boolean
}

type EmployeeRow = {
  userId: string
  firstName: string
  lastName: string
  hasOvertime: boolean
  bars: BarSegment[]
  earliestStart: string
}

function ClassificationRow({
  classification,
  currentBlock,
  readonly,
  onBlockClick,
}: {
  classification: DayGridClassification
  currentBlock: number
  readonly?: boolean
  onBlockClick: (block: ClassificationBlock) => void
}) {
  const [expanded, setExpanded] = useState(true)

  const { abbreviation, blocks } = classification

  // Group employees: one row per person, multiple bars when they have OT
  const employeeRows = useMemo(() => {
    const byUser = new Map<string, EmployeeRow>()
    const seenAssignments = new Set<string>()
    for (const b of blocks) {
      for (const e of b.employees) {
        if (seenAssignments.has(e.assignment_id)) continue
        seenAssignments.add(e.assignment_id)
        let row = byUser.get(e.user_id)
        if (!row) {
          row = {
            userId: e.user_id,
            firstName: e.first_name,
            lastName: e.last_name,
            hasOvertime: false,
            bars: [],
            earliestStart: e.shift_start,
          }
          byUser.set(e.user_id, row)
        }
        row.bars.push({
          assignmentId: e.assignment_id,
          shiftName: e.shift_name,
          shiftStart: e.shift_start,
          shiftEnd: e.shift_end,
          isOvertime: e.is_overtime,
        })
        if (e.is_overtime) row.hasOvertime = true
        if (e.shift_start < row.earliestStart) row.earliestStart = e.shift_start
      }
    }
    return Array.from(byUser.values()).sort(
      (a, b) => a.earliestStart.localeCompare(b.earliestStart) || a.lastName.localeCompare(b.lastName),
    )
  }, [blocks])

  const hasShortage = blocks.some((b) => b.status === 'red' || b.status === 'yellow')

  return (
    <div className={cn('border rounded-lg overflow-hidden', hasShortage && 'border-amber-300/60')}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors border-b"
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span className="font-semibold text-sm">{abbreviation}</span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" />
          {employeeRows.length} {employeeRows.length === 1 ? 'person' : 'people'}
        </span>
        {hasShortage && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
            Shortage
          </Badge>
        )}
      </button>

      {expanded && (
        <>
          {/* Employee Gantt rows */}
          {employeeRows.length > 0 ? (
            <div className="bg-card">
              {employeeRows.map((emp, idx) => (
                <div
                  key={emp.userId}
                  className={cn(
                    'flex items-center',
                    idx !== employeeRows.length - 1 && 'border-b border-dashed border-border/50',
                  )}
                >
                  {/* Name column */}
                  <div className="w-36 shrink-0 border-r px-2 py-1 flex items-center gap-1 min-h-[28px]">
                    <span className="text-xs truncate">
                      {emp.lastName}, {emp.firstName[0]}.
                    </span>
                    {emp.hasOvertime && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-3.5 shrink-0 text-amber-700 border-amber-400 bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-900/30"
                      >
                        OT
                      </Badge>
                    )}
                  </div>
                  {/* Gantt bar area */}
                  <div className="flex-1 relative h-7">
                    {emp.bars.map((bar) => {
                      const pos = barPosition(bar.shiftStart, bar.shiftEnd)
                      return (
                        <Tooltip key={bar.assignmentId}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'absolute top-1 h-5 rounded text-[10px] font-medium flex items-center px-1.5 truncate shadow-sm',
                                bar.isOvertime
                                  ? 'bg-amber-300/80 text-amber-950 dark:bg-amber-700/70 dark:text-amber-50'
                                  : 'bg-indigo-300/70 text-indigo-950 dark:bg-indigo-700/60 dark:text-indigo-50',
                              )}
                              style={{ left: pos.left, width: pos.width }}
                            >
                              <span className="truncate">
                                {bar.shiftName}
                                {bar.isOvertime && ' OT'}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <div className="text-xs">
                              <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                              <div>{bar.shiftName} ({bar.shiftStart}&ndash;{bar.shiftEnd})</div>
                              {bar.isOvertime && <div className="text-amber-600 font-medium">Overtime</div>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-muted-foreground italic bg-card">
              No employees assigned
            </div>
          )}

          {/* Coverage summary: Min row + Actual row */}
          <div className="border-t bg-muted/20">
            {/* Min row */}
            <div className="flex">
              <div className="w-36 shrink-0 border-r flex items-center px-2">
                <span className="text-[10px] text-muted-foreground">Min</span>
              </div>
              <div
                className="flex-1 grid"
                style={{ gridTemplateColumns: `repeat(${BLOCK_COUNT}, 1fr)` }}
              >
                {BLOCK_COLUMNS.map((col) => {
                  const block = blocks[col.index]
                  return (
                    <div
                      key={col.index}
                      className={cn(
                        'border-r last:border-r-0 h-5 flex items-center justify-center text-[10px] tabular-nums text-muted-foreground',
                        col.index === currentBlock && 'bg-primary/10',
                      )}
                    >
                      {block?.min ?? ''}
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Actual row — color-coded, clickable when red and not readonly */}
            <div className="flex">
              <div className="w-36 shrink-0 border-r flex items-center px-2">
                <span className="text-[10px] font-semibold text-foreground">Actual</span>
              </div>
              <div
                className="flex-1 grid"
                style={{ gridTemplateColumns: `repeat(${BLOCK_COUNT}, 1fr)` }}
              >
                {BLOCK_COLUMNS.map((col) => {
                  const block = blocks[col.index]
                  if (!block) return <div key={col.index} className="border-r last:border-r-0 h-6" />
                  const isClickable = !readonly && block.status === 'red'
                  return (
                    <button
                      key={col.index}
                      type="button"
                      disabled={!isClickable}
                      tabIndex={isClickable ? 0 : -1}
                      role={isClickable ? 'button' : undefined}
                      aria-label={
                        isClickable
                          ? `${abbreviation} ${block.start_time}-${block.end_time}: ${block.actual}/${block.min} staffed — click to resolve`
                          : `${abbreviation} ${block.start_time}-${block.end_time}: ${block.actual}/${block.min} staffed`
                      }
                      onClick={() => isClickable && onBlockClick(block)}
                      onKeyDown={(e) => {
                        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          onBlockClick(block)
                        }
                      }}
                      className={cn(
                        'border-r last:border-r-0 h-6 flex items-center justify-center text-xs tabular-nums font-bold transition-colors',
                        block.status === 'green' && 'text-green-800 dark:text-green-400',
                        block.status === 'yellow' && 'text-yellow-800 dark:text-yellow-400',
                        block.status === 'red' && 'bg-red-100 text-red-800 font-black dark:bg-red-950/30 dark:text-red-400',
                        isClickable && 'cursor-pointer hover:bg-accent/50 focus:ring-1 focus:ring-primary focus:outline-none',
                        col.index === currentBlock && 'bg-primary/10',
                      )}
                      title={`${abbreviation} ${block.start_time}-${block.end_time}: ${block.actual}/${block.min} staffed`}
                    >
                      {block.actual}/{block.min}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calculate CSS left% and width% for a Gantt bar spanning shiftStart–shiftEnd. */
function barPosition(shiftStart: string, shiftEnd: string) {
  const [sh, sm] = shiftStart.split(':').map(Number)
  const [eh, em] = shiftEnd.split(':').map(Number)
  const startMin = sh * 60 + sm
  let endMin = eh * 60 + em
  if (endMin <= startMin) endMin = 24 * 60 // crosses midnight
  const totalMin = 24 * 60
  const left = (startMin / totalMin) * 100
  const width = ((endMin - startMin) / totalMin) * 100
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }
}
