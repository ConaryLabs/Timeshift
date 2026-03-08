// frontend/src/pages/DashboardPage.tsx
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Phone,
  AlertTriangle,
  Calendar,
  ShieldAlert,
  Timer,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard } from '@/hooks/queries'
import { AnnotationBadge } from '@/components/AnnotationBadge'
import { cn } from '@/lib/utils'
import { formatTime, contrastText } from '@/lib/format'
import type { ClassificationCoverageDetail } from '@/api/schedule'

const CLICKABLE_CARD_CLASS = 'cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function handleCardKeyDown(e: React.KeyboardEvent, action: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    action()
  }
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useDashboard()
  const today = format(new Date(), 'yyyy-MM-dd')

  if (isLoading) return (
    <div>
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-64 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
  if (error) return <ErrorState message="Failed to load dashboard data." onRetry={() => refetch()} />
  if (!data) return null

  const { current_coverage, pending_leave_count, open_callout_count, annotations } = data

  const coverageIssues = current_coverage.filter(
    (s) => s.coverage_status === 'red' || s.coverage_status === 'yellow',
  )

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={format(new Date(), 'EEEE, MMMM d, yyyy')}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/staffing/resolve?date=${today}`)}>
              <ShieldAlert className="h-4 w-4 mr-1.5" />
              Daily Staffing
            </Button>
            <Button variant="outline" onClick={() => navigate('/available-ot')}>
              <Timer className="h-4 w-4 mr-1.5" />
              Create OT Request
            </Button>
            <Button variant="outline" onClick={() => navigate(`/schedule/day/${today}`)}>
              <Calendar className="h-4 w-4 mr-1.5" />
              Day View
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card
          className={CLICKABLE_CARD_CLASS}
          tabIndex={0}
          role="button"
          onClick={() => navigate('/leave')}
          onKeyDown={(e) => handleCardKeyDown(e, () => navigate('/leave'))}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Leave
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pending_leave_count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pending_leave_count === 0
                ? 'No requests awaiting review'
                : `${pending_leave_count} request${pending_leave_count > 1 ? 's' : ''} awaiting review`}
            </p>
          </CardContent>
        </Card>

        <Card
          className={CLICKABLE_CARD_CLASS}
          tabIndex={0}
          role="button"
          onClick={() => navigate('/callout')}
          onKeyDown={(e) => handleCardKeyDown(e, () => navigate('/callout'))}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open Callouts
            </CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{open_callout_count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {open_callout_count === 0 ? 'No active callouts' : 'Active callout events'}
            </p>
          </CardContent>
        </Card>

        <Card
          className={CLICKABLE_CARD_CLASS}
          tabIndex={0}
          role="button"
          onClick={() => navigate(`/schedule/day/${today}`)}
          onKeyDown={(e) => handleCardKeyDown(e, () => navigate(`/schedule/day/${today}`))}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coverage Issues
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-3xl font-bold',
                coverageIssues.length > 0 ? 'text-destructive' : 'text-green-600',
              )}
            >
              {coverageIssues.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {coverageIssues.length === 0
                ? 'All shifts fully covered'
                : `${coverageIssues.length} shift${coverageIssues.length > 1 ? 's' : ''} need attention`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Shift coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's Shift Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            {current_coverage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shifts scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {current_coverage.map((entry) => (
                  <div
                    key={entry.shift_template_id}
                    className="flex items-center gap-3 p-2 rounded-md border"
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: entry.shift_color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{entry.shift_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {entry.assignments.map((a) => (
                          <span
                            key={a.assignment_id}
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: entry.shift_color,
                              color: contrastText(entry.shift_color),
                            }}
                          >
                            {a.last_name}
                            {a.is_overtime && (
                              <span className="ml-0.5 font-bold">OT</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <CoverageIndicator
                        actual={entry.coverage_actual}
                        required={entry.coverage_required}
                        status={entry.coverage_status}
                        byClassification={entry.coverage_by_classification}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Annotations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {annotations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No annotations for today</p>
            ) : (
              <div className="space-y-2">
                {annotations.map((ann) => (
                  <AnnotationBadge
                    key={ann.id}
                    type={ann.annotation_type}
                    content={ann.content}
                    className="items-start p-2"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
  return (
    <div className="flex flex-col items-end">
      <span
        className={cn(
          'text-sm font-semibold',
          status === 'green' && 'text-green-600',
          status === 'yellow' && 'text-amber-500',
          status === 'red' && 'text-destructive',
        )}
      >
        {actual}/{required}
      </span>
      {byClassification && byClassification.length > 0 ? (
        <div className="flex items-center gap-1 mt-0.5">
          {byClassification.map((c) => (
            <span
              key={c.classification_abbreviation}
              className="text-[9px] font-medium text-red-600 dark:text-red-400"
            >
              {c.classification_abbreviation}&nbsp;−{c.shortage}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground">staff</span>
      )}
    </div>
  )
}
