import { lazy, Suspense, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUIStore } from '@/store/ui'
import { toLocalDateStr } from '@/lib/format'
import { ScheduleHeader } from './ScheduleHeader'
import { LoadingState } from '@/components/ui/loading-state'
import type { CalendarView } from './types'

const DailyView = lazy(() =>
  import('./DailyView').then((m) => ({ default: m.DailyView }))
)
const WeekView = lazy(() =>
  import('./WeekView').then((m) => ({ default: m.WeekView }))
)
const MonthView = lazy(() =>
  import('./MonthView').then((m) => ({ default: m.MonthView }))
)

function parseDate(str: string | null): Date {
  if (str) {
    const d = new Date(str + 'T00:00:00')
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

export default function UnifiedSchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const preferredView = useUIStore((s) => s.preferredScheduleView)
  const setPreferredView = useUIStore((s) => s.setPreferredScheduleView)
  const selectedTeamId = useUIStore((s) => s.selectedTeamId)

  const view = (searchParams.get('view') as CalendarView) || preferredView
  const date = parseDate(searchParams.get('date'))

  const setView = useCallback((v: CalendarView) => {
    setPreferredView(v)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('view', v)
      return next
    }, { replace: true })
  }, [setPreferredView, setSearchParams])

  const setDate = useCallback((d: Date) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('date', toLocalDateStr(d))
      return next
    }, { replace: true })
  }, [setSearchParams])

  // When MonthView clicks a day, switch to day view
  const handleMonthDateChange = useCallback((d: Date) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('view', 'day')
      next.set('date', toLocalDateStr(d))
      return next
    }, { replace: true })
  }, [setSearchParams])

  return (
    <div className="space-y-4 p-4">
      <ScheduleHeader
        date={date}
        view={view}
        onDateChange={setDate}
        onViewChange={setView}
      />
      <Suspense fallback={<LoadingState />}>
        {view === 'day' && <DailyView date={date} teamId={selectedTeamId} />}
        {view === 'week' && <WeekView date={date} onDateChange={setDate} teamId={selectedTeamId} />}
        {view === 'month' && <MonthView date={date} onDateChange={handleMonthDateChange} teamId={selectedTeamId} />}
      </Suspense>
    </div>
  )
}
