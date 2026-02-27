import { Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  ClipboardList,
  ArrowLeftRight,
  Sun,
  ChevronRight,
  Siren,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import { useMyDashboard, useOtRequests } from '@/hooks/queries'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { useAuthStore } from '@/store/auth'
import type { MyScheduleEntry } from '@/api/employee'

function formatTime(time: string) {
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${display}:${m} ${ampm}`
}


function ShiftCard({ entry, label }: { entry: MyScheduleEntry; label: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 h-10 w-1 rounded-full shrink-0"
            style={{ backgroundColor: entry.shift_color }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-lg">{entry.shift_name}</p>
            <p className="text-sm text-muted-foreground">
              {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
              {entry.crosses_midnight && ' +1'}
            </p>
            {label !== "Today's Shift" && (
              <p className="text-sm text-muted-foreground mt-0.5">{formatDate(entry.date)}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {entry.team_name && (
                <span className="text-xs text-muted-foreground">{entry.team_name}</span>
              )}
              {entry.position && (
                <span className="text-xs text-muted-foreground">
                  {entry.team_name ? ' \u00b7 ' : ''}{entry.position}
                </span>
              )}
            </div>
            {(entry.is_overtime || entry.is_trade) && (
              <div className="flex gap-1.5 mt-2">
                {entry.is_overtime && <Badge variant="secondary">OT</Badge>}
                {entry.is_trade && <Badge variant="secondary">Trade</Badge>}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DayOffCard({ label }: { label: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Sun className="h-8 w-8" />
          <div>
            <p className="font-medium text-foreground">Day Off</p>
            <p className="text-sm">No shift scheduled</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MyDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data: dashboard, isLoading, isError, refetch } = useMyDashboard()
  const { data: volunteeredOt } = useOtRequests({ volunteered_by_me: true })
  const activeVolunteers = volunteeredOt?.filter(
    (r) => r.status === 'open' || r.status === 'partially_filled' || r.status === 'filled',
  ) ?? []
  const assignedCount = activeVolunteers.filter((r) => r.user_assigned).length

  if (isLoading) return <LoadingState message="Loading dashboard..." />
  if (isError) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-sm text-destructive">Failed to load dashboard data.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const greeting = getGreeting()

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={`${greeting}, ${user?.first_name ?? 'there'}`}
        description="Your personal dashboard"
      />

      {/* Top row: Today + Next */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {dashboard?.today_shift ? (
          <ShiftCard entry={dashboard.today_shift} label="Today's Shift" />
        ) : (
          <DayOffCard label="Today's Shift" />
        )}

        {dashboard?.next_shift ? (
          <ShiftCard entry={dashboard.next_shift} label="Next Shift" />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Next Shift</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">No upcoming shifts scheduled</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action items */}
      {(dashboard?.pending_leave_count || dashboard?.pending_trade_count || activeVolunteers.length > 0) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {!!dashboard?.pending_leave_count && (
            <Card>
              <CardContent className="py-4">
                <Link to="/leave" className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <ClipboardList className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Pending Leave Requests</p>
                      <p className="text-xs text-muted-foreground">
                        {dashboard.pending_leave_count} request{dashboard.pending_leave_count !== 1 ? 's' : ''} pending
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              </CardContent>
            </Card>
          )}

          {!!dashboard?.pending_trade_count && (
            <Card>
              <CardContent className="py-4">
                <Link to="/trades" className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Pending Trades</p>
                      <p className="text-xs text-muted-foreground">
                        {dashboard.pending_trade_count} trade{dashboard.pending_trade_count !== 1 ? 's' : ''} pending
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              </CardContent>
            </Card>
          )}

          {activeVolunteers.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <Link to="/volunteered-ot" className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Siren className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Volunteered OT</p>
                      <p className="text-xs text-muted-foreground">
                        {activeVolunteers.length} slot{activeVolunteers.length !== 1 ? 's' : ''}
                        {assignedCount > 0 && ` \u00b7 ${assignedCount} assigned`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Leave balances */}
      {dashboard?.leave_balances && dashboard.leave_balances.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Leave Balances
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {dashboard.leave_balances.map((bal) => {
              const isZero = bal.balance_hours <= 0
              const isLow = !isZero && bal.balance_hours < 8
              return (
                <Card key={bal.leave_type_code}>
                  <CardContent className="py-3">
                    <p className="text-xs text-muted-foreground truncate">{bal.leave_type_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className={cn(
                        'text-lg font-semibold',
                        isZero && 'text-destructive',
                        isLow && 'text-amber-600',
                      )}>
                        {bal.balance_hours.toFixed(1)} hrs
                      </p>
                      {isLow && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming week */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Upcoming Week
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/my-schedule" className="gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Full Schedule
            </Link>
          </Button>
        </div>

        {dashboard?.upcoming_shifts && dashboard.upcoming_shifts.length > 0 ? (
          <div className="space-y-2">
            {dashboard.upcoming_shifts.map((entry, i) => (
              <Card key={i}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-1 rounded-full shrink-0"
                      style={{ backgroundColor: entry.shift_color }}
                    />
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{entry.shift_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.team_name}{entry.position ? ` \u00b7 ${entry.position}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{formatDate(entry.date)}</p>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-0.5" />
                          {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                        </p>
                      </div>
                    </div>
                    {(entry.is_overtime || entry.is_trade) && (
                      <div className="flex gap-1 shrink-0">
                        {entry.is_overtime && <Badge variant="secondary" className="text-[10px]">OT</Badge>}
                        {entry.is_trade && <Badge variant="secondary" className="text-[10px]">Trade</Badge>}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              No shifts scheduled for the upcoming week
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
