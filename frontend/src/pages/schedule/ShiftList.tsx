// frontend/src/pages/schedule/ShiftList.tsx
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useDayView } from '@/hooks/queries'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AssignmentChip } from './AssignmentChip'
import type { ClassificationCoverageDetail } from '@/api/schedule'

export interface ShiftListProps {
  date: string          // "YYYY-MM-DD"
  teamId?: string | null
}

export function ShiftList({ date }: ShiftListProps) {
  const { data: entries, isLoading } = useDayView(date)

  if (isLoading) {
    return <LoadingState />
  }

  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        title="No shifts on this date"
        description="There are no scheduled shifts for this day."
      />
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <Card key={entry.shift_template_id} className="overflow-hidden py-0 gap-0">
          {/* Colored left border strip via header row */}
          <div
            className="flex items-center gap-3 px-4 py-2.5 border-b"
            style={{ borderLeftWidth: 4, borderLeftColor: entry.shift_color }}
          >
            {/* Shift name + times */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{entry.shift_name}</span>
                <span className="text-sm text-muted-foreground">
                  {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                  {entry.crosses_midnight && (
                    <span className="ml-1 text-xs opacity-70">→</span>
                  )}
                </span>
              </div>
            </div>

            {/* Coverage badge */}
            <CoverageBadge
              actual={entry.coverage_actual}
              required={entry.coverage_required}
              status={entry.coverage_status}
              byClassification={entry.coverage_by_classification}
            />
          </div>

          {/* Assignment chips */}
          <CardContent className="px-4 py-3">
            {entry.assignments.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">No assignments</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {entry.assignments.map((a) => (
                  <AssignmentChip
                    key={a.assignment_id}
                    firstName={a.first_name}
                    lastName={a.last_name}
                    shiftColor={entry.shift_color}
                    classificationAbbreviation={a.classification_abbreviation}
                    isOvertime={a.is_overtime}
                    isTrade={a.is_trade}
                    notes={a.notes}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CoverageBadge({
  actual,
  required,
  status,
  byClassification,
}: {
  actual: number
  required: number
  status: 'green' | 'yellow' | 'red'
  byClassification?: ClassificationCoverageDetail[]
}) {
  if (required === 0 && actual === 0) {
    return <span className="text-xs text-muted-foreground">No requirement</span>
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium',
          status === 'green' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
          status === 'yellow' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
          status === 'red' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        )}
      >
        {status === 'red' && <AlertTriangle className="h-3.5 w-3.5" />}
        {actual}/{required}
      </span>

      {/* Per-classification shortage breakdown — only shown when red */}
      {status === 'red' && byClassification && byClassification.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {byClassification.map((c) => (
            <span
              key={c.classification_abbreviation}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            >
              {c.classification_abbreviation} −{c.shortage}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
