import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import { PageHeader } from '@/components/ui/page-header'
import { useVacationBidWindow, useSubmitVacationBid } from '@/hooks/queries'
import { cn } from '@/lib/utils'

interface DatePick {
  start_date: string
  end_date: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  })
}

function dateToStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function getMondayOfWeek(d: Date): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return dateToStr(date)
}

function getSundayOfWeek(d: Date): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? 0 : 7 - day
  date.setDate(date.getDate() + diff)
  return dateToStr(date)
}

function isDateInRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end
}

export default function VacationBidPage() {
  const { windowId } = useParams<{ windowId: string }>()
  const { data, isLoading, isError } = useVacationBidWindow(windowId ?? '')
  const submitMut = useSubmitVacationBid()
  const [picks, setPicks] = useState<DatePick[]>([])

  const takenSet = useMemo(() => {
    if (!data) return new Set<string>()
    return new Set(data.dates_taken)
  }, [data])

  const selectedDates = useMemo(() => {
    const set = new Set<string>()
    for (const pick of picks) {
      const start = new Date(pick.start_date + 'T00:00:00')
      const end = new Date(pick.end_date + 'T00:00:00')
      const d = new Date(start)
      while (d <= end) {
        set.add(dateToStr(d))
        d.setDate(d.getDate() + 1)
      }
    }
    return set
  }, [picks])

  const window = data?.window
  const round = useMemo(() => {
    if (!window) return 1
    // Determine round from the period - we need to check if it's round 1 or 2
    // The window detail doesn't directly have round, but we can check from bids or infer
    // For now, we'll need to pass it somehow. Let's check the period query.
    // Actually, the VacationWindowDetail doesn't include round. We'll add it to the query response.
    // For now, default to round 2 (individual days) as it's the most flexible
    return 1 // Will be determined by actual period data
  }, [window])

  const isWindowOpen = useMemo(() => {
    if (!window) return false
    const now = new Date()
    return now >= new Date(window.opens_at) && now <= new Date(window.closes_at)
  }, [window])

  const hasSubmitted = !!window?.submitted_at

  const year = useMemo(() => {
    if (!window) return new Date().getFullYear()
    // Infer year from window dates
    return new Date(window.opens_at).getFullYear()
  }, [window])

  const handleDayClick = useCallback((date: Date) => {
    const dateStr = dateToStr(date)

    // Can't select taken dates
    if (takenSet.has(dateStr)) return

    // Check if already selected - if so, remove the pick containing it
    const existingIdx = picks.findIndex(
      (p) => isDateInRange(dateStr, p.start_date, p.end_date),
    )
    if (existingIdx >= 0) {
      setPicks((prev) => prev.filter((_, i) => i !== existingIdx))
      return
    }

    // Round 1: select full week (Mon-Sun)
    if (round === 1) {
      const monday = getMondayOfWeek(date)
      const sunday = getSundayOfWeek(date)

      // Check no dates in the week are taken
      const weekStart = new Date(monday + 'T00:00:00')
      const weekEnd = new Date(sunday + 'T00:00:00')
      const d = new Date(weekStart)
      while (d <= weekEnd) {
        if (takenSet.has(dateToStr(d))) {
          toast.error('Some dates in this week are already taken')
          return
        }
        d.setDate(d.getDate() + 1)
      }

      setPicks((prev) => [...prev, { start_date: monday, end_date: sunday }])
    } else {
      // Round 2: individual days
      setPicks((prev) => [...prev, { start_date: dateStr, end_date: dateStr }])
    }
  }, [picks, takenSet, round])

  function handleRemovePick(index: number) {
    setPicks((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    if (!windowId || picks.length === 0) return

    const rankedPicks = picks.map((p, i) => ({
      start_date: p.start_date,
      end_date: p.end_date,
      preference_rank: i + 1,
    }))

    submitMut.mutate(
      { windowId, picks: rankedPicks },
      {
        onSuccess: () => {
          toast.success('Vacation bid submitted successfully')
          setPicks([])
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to submit bid'
          toast.error(msg)
        },
      },
    )
  }

  if (isLoading) return <LoadingState message="Loading vacation bid window..." />
  if (isError || !data) return <p className="text-sm text-destructive p-6">Failed to load vacation bid window.</p>

  return (
    <div>
      <PageHeader
        title="Vacation Bid"
        description={`${window?.first_name} ${window?.last_name} - Seniority Rank #${window?.seniority_rank}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Status info */}
          <Card>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-blue-500" />
                  <span>Your Selection</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-red-200" />
                  <span>Taken</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-green-200" />
                  <span>Awarded</span>
                </div>
              </div>
              {isWindowOpen ? (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  Window Open
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                  {new Date() < new Date(window?.opens_at ?? '') ? 'Not Yet Open' : 'Window Closed'}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Monthly calendars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 12 }, (_, month) => (
              <MonthCalendar
                key={month}
                year={year}
                month={month}
                takenDates={takenSet}
                selectedDates={selectedDates}
                awardedBids={data.bids.filter((b) => b.awarded)}
                onDayClick={isWindowOpen && !hasSubmitted ? handleDayClick : undefined}
              />
            ))}
          </div>
        </div>

        {/* Sidebar: picks */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {hasSubmitted ? 'Your Submitted Picks' : 'Your Picks'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasSubmitted && data.bids.length > 0 ? (
                <>
                  {data.bids.map((bid) => (
                    <div
                      key={bid.id}
                      className="flex items-center justify-between text-sm border rounded-md px-3 py-2"
                    >
                      <div>
                        <span className="text-muted-foreground mr-2">#{bid.preference_rank}</span>
                        {formatDate(bid.start_date)}
                        {bid.start_date !== bid.end_date && ` - ${formatDate(bid.end_date)}`}
                      </div>
                      {bid.awarded ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted {new Date(window?.submitted_at ?? '').toLocaleString()}
                  </p>
                </>
              ) : picks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {isWindowOpen
                    ? `Click on the calendar to select ${round === 1 ? 'full weeks' : 'dates'}.`
                    : 'No picks to display.'}
                </p>
              ) : (
                <>
                  {picks.map((pick, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm border rounded-md px-3 py-2"
                    >
                      <div>
                        <span className="text-muted-foreground mr-2">#{i + 1}</span>
                        {formatDate(pick.start_date)}
                        {pick.start_date !== pick.end_date && ` - ${formatDate(pick.end_date)}`}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleRemovePick(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </>
              )}

              {isWindowOpen && !hasSubmitted && picks.length > 0 && (
                <Button
                  className="w-full mt-4"
                  onClick={handleSubmit}
                  disabled={submitMut.isPending}
                >
                  Submit Vacation Bid
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Window timing info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Window Info</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Opens:</span>{' '}
                {new Date(window?.opens_at ?? '').toLocaleString()}
              </p>
              <p>
                <span className="text-muted-foreground">Closes:</span>{' '}
                {new Date(window?.closes_at ?? '').toLocaleString()}
              </p>
              <p>
                <span className="text-muted-foreground">Round:</span>{' '}
                {round === 1 ? 'Round 1 (Full Weeks)' : 'Round 2 (Individual Days)'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MonthCalendar({
  year,
  month,
  takenDates,
  selectedDates,
  awardedBids,
  onDayClick,
}: {
  year: number
  month: number
  takenDates: Set<string>
  selectedDates: Set<string>
  awardedBids: { start_date: string; end_date: string }[]
  onDayClick?: (date: Date) => void
}) {
  const days = getMonthDays(year, month)
  const firstDayOfWeek = days[0].getDay()

  const awardedSet = useMemo(() => {
    const set = new Set<string>()
    for (const bid of awardedBids) {
      const start = new Date(bid.start_date + 'T00:00:00')
      const end = new Date(bid.end_date + 'T00:00:00')
      const d = new Date(start)
      while (d <= end) {
        set.add(dateToStr(d))
        d.setDate(d.getDate() + 1)
      }
    }
    return set
  }, [awardedBids])

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm font-medium text-center">{MONTHS[month]} {year}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <div className="grid grid-cols-7 gap-0">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">
              {d}
            </div>
          ))}
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((date) => {
            const dateStr = dateToStr(date)
            const isTaken = takenDates.has(dateStr)
            const isSelected = selectedDates.has(dateStr)
            const isAwarded = awardedSet.has(dateStr)
            const isWeekend = date.getDay() === 0 || date.getDay() === 6

            return (
              <button
                key={dateStr}
                type="button"
                disabled={!onDayClick || isTaken}
                onClick={() => onDayClick?.(date)}
                className={cn(
                  'h-7 w-full text-xs rounded-sm transition-colors',
                  'hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent',
                  isTaken && 'bg-red-100 text-red-400',
                  isSelected && !isTaken && 'bg-blue-500 text-white hover:bg-blue-600',
                  isAwarded && !isSelected && 'bg-green-200 text-green-800',
                  isWeekend && !isTaken && !isSelected && !isAwarded && 'text-muted-foreground',
                )}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
