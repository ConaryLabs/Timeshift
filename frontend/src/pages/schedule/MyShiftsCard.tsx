// frontend/src/pages/schedule/MyShiftsCard.tsx
import { useNavigate } from 'react-router-dom'
import { CalendarOff, ArrowLeftRight, ClipboardList } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMySchedule } from '@/hooks/queries'
import { toLocalDateStr, formatTime } from '@/lib/format'
import type { MyScheduleEntry } from '@/api/employee'

interface MyShiftsCardProps {
  date: Date
}

export function MyShiftsCard({ date }: MyShiftsCardProps) {
  const navigate = useNavigate()
  const dateStr = toLocalDateStr(date)

  const { data: entries, isLoading } = useMySchedule(dateStr, dateStr)

  const shifts: MyScheduleEntry[] = (entries ?? []).filter((e) => e.date === dateStr)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Loading shifts...
        </CardContent>
      </Card>
    )
  }

  if (shifts.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-3 text-muted-foreground">
          <CalendarOff className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium text-foreground">Day Off</p>
            <p className="text-xs">No shifts scheduled for this day.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with quick actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">My Shifts</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => navigate(`/leave?date=${dateStr}`)}
          >
            <CalendarOff className="h-3.5 w-3.5" />
            Request Leave
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => navigate(`/trades?date=${dateStr}`)}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Request Trade
          </Button>
        </div>
      </div>

      {/* Shift cards */}
      {shifts.map((entry) => (
        <Card key={`${entry.date}-${entry.shift_name}-${entry.start_time}`} className="overflow-hidden">
          {/* Color bar */}
          <div className="h-1.5" style={{ backgroundColor: entry.shift_color }} />
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm truncate">{entry.shift_name}</p>
              <div className="flex items-center gap-1 shrink-0">
                {entry.is_overtime && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">OT</Badge>
                )}
                {entry.is_trade && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Trade</Badge>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
              {entry.crosses_midnight && ' (+1)'}
            </p>

            {entry.team_name && (
              <p className="text-xs text-muted-foreground truncate">{entry.team_name}</p>
            )}

            {entry.position && (
              <p className="text-xs text-muted-foreground truncate">{entry.position}</p>
            )}

            {entry.notes && (
              <div className="flex items-start gap-1.5 pt-1">
                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">{entry.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
