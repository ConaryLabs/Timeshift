import { useState, useCallback } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Clock, Check, Lock, ArrowUp, ArrowDown, Send, Trophy, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useBidWindow, useSubmitBid } from '@/hooks/queries'
import { formatTime } from '@/lib/format'
import type { AvailableSlot } from '@/api/bidding'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWindowStatus(window: { opens_at: string; closes_at: string; submitted_at: string | null; unlocked_at: string | null }) {
  if (!window.unlocked_at) return 'locked'
  if (window.submitted_at) return 'submitted'
  const now = new Date()
  const opens = new Date(window.opens_at)
  const closes = new Date(window.closes_at)
  if (now < opens) return 'upcoming'
  if (now > closes) return 'closed'
  return 'open'
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function timeRemaining(closes: string) {
  const diff = new Date(closes).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${mins}m remaining`
  return `${mins}m remaining`
}

export default function BidPage() {
  const { windowId } = useParams<{ windowId: string }>()
  const [selectedSlots, setSelectedSlots] = useState<AvailableSlot[]>([])

  const { data: detail, isLoading, isError, refetch } = useBidWindow(windowId ?? '')
  const submitMut = useSubmitBid()

  const moveUp = useCallback((index: number) => {
    if (index === 0) return
    setSelectedSlots((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }, [])

  const moveDown = useCallback((index: number) => {
    setSelectedSlots((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }, [])

  const toggleSlot = useCallback((slot: AvailableSlot) => {
    setSelectedSlots((prev) => {
      const exists = prev.find((s) => s.slot_id === slot.slot_id)
      if (exists) return prev.filter((s) => s.slot_id !== slot.slot_id)
      return [...prev, slot]
    })
  }, [])

  if (!windowId) return <Navigate to="/schedule" replace />
  if (isLoading) return <LoadingState message="Loading bid window..." />
  if (isError || !detail) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-sm text-destructive">Failed to load bid window.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const { window: bidWindow, available_slots, submissions } = detail
  const status = getWindowStatus(bidWindow)
  const isOpen = status === 'open'
  const hasSubmissions = submissions.length > 0

  function handleSubmit() {
    if (selectedSlots.length === 0) {
      toast.error('Select at least one slot preference')
      return
    }
    submitMut.mutate(
      {
        windowId: windowId!,
        preferences: selectedSlots.map((s, i) => ({
          slot_id: s.slot_id,
          preference_rank: i + 1,
        })),
      },
      {
        onSuccess: () => {
          toast.success('Bid submitted successfully')
          setSelectedSlots([])
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to submit bid'
          toast.error(msg)
        },
      },
    )
  }

  const statusBadge = {
    locked: <Badge variant="secondary"><Lock className="w-3 h-3 mr-1" />Locked</Badge>,
    upcoming: <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Upcoming</Badge>,
    open: <Badge className="bg-green-600 hover:bg-green-700"><Clock className="w-3 h-3 mr-1" />Open</Badge>,
    submitted: <Badge className="bg-blue-600 hover:bg-blue-700"><Check className="w-3 h-3 mr-1" />Submitted</Badge>,
    closed: <Badge variant="outline"><Lock className="w-3 h-3 mr-1" />Closed</Badge>,
  }[status]

  const availableForBid = available_slots.filter((s) => !s.already_awarded)
  const awardedSlots = available_slots.filter((s) => s.already_awarded)

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Shift Bid"
        description={`Seniority Rank #${bidWindow.seniority_rank} - ${bidWindow.first_name} ${bidWindow.last_name}`}
        actions={
          <div className="flex items-center gap-2">
            {bidWindow.is_job_share && (
              <Badge variant="outline" className="border-purple-300 text-purple-700">Job Share</Badge>
            )}
            {statusBadge}
          </div>
        }
      />

      {/* Locked banner */}
      {status === 'locked' && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-amber-800">
              <Lock className="w-5 h-5 shrink-0" />
              <p className="text-sm">
                Your bid window is locked. A supervisor must approve the previous employee's bid before you can submit.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timing info */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Opens:</span>{' '}
              <span className="font-medium">{formatDateTime(bidWindow.opens_at)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Closes:</span>{' '}
              <span className="font-medium">{formatDateTime(bidWindow.closes_at)}</span>
            </div>
            <div>
              {status === 'open' && (
                <span className="font-medium text-green-600">{timeRemaining(bidWindow.closes_at)}</span>
              )}
              {status === 'upcoming' && (
                <span className="text-muted-foreground">Opens {formatDateTime(bidWindow.opens_at)}</span>
              )}
              {status === 'submitted' && bidWindow.submitted_at && (
                <span className="text-blue-600">Submitted {formatDateTime(bidWindow.submitted_at)}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous submissions (if already submitted) */}
      {hasSubmissions && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Your Bid</CardTitle>
            <CardDescription>
              {status === 'submitted' ? 'Your ranked preferences (you can resubmit while your window is open)' : 'Your submitted preferences'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${sub.awarded ? 'bg-green-50 border-green-200' : 'bg-muted/30'}`}
                >
                  <span className="text-sm font-bold text-muted-foreground w-6 text-center">
                    #{sub.preference_rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{sub.shift_template_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {sub.team_name} · {sub.classification_name}
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {sub.days_of_week.map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium w-7 h-5"
                      >
                        {DAY_LABELS[d]}
                      </span>
                    ))}
                  </div>
                  {sub.awarded ? (
                    <Badge className="bg-green-600"><Trophy className="w-3 h-3 mr-1" />Awarded</Badge>
                  ) : (
                    <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Not awarded</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bid interface (only when window is open) */}
      {isOpen && (
        <>
          {/* Selected preferences (ranking area) */}
          {selectedSlots.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Your Ranked Preferences</CardTitle>
                <CardDescription>
                  Drag to reorder. #1 is your top choice.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedSlots.map((slot, index) => (
                    <div
                      key={slot.slot_id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <span className="text-sm font-bold text-primary w-6 text-center">
                        #{index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {slot.shift_template_name}
                          {slot.is_flex && (
                            <Badge variant="outline" className="text-xs border-teal-300 text-teal-700 py-0 h-5">Flex</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {slot.team_name} · {formatTime(slot.start_time)} - {formatTime(slot.end_time)} · {slot.classification_abbreviation}
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {slot.days_of_week.map((d) => (
                          <span
                            key={d}
                            className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium w-7 h-5"
                          >
                            {DAY_LABELS[d]}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          aria-label="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => moveDown(index)}
                          disabled={index === selectedSlots.length - 1}
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                          onClick={() => toggleSlot(slot)}
                          aria-label="Remove from preferences"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSubmit} disabled={submitMut.isPending}>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Bid
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available slots */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Slots</CardTitle>
              <CardDescription>
                Click to add to your preferences. Already-awarded slots are shown for reference.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availableForBid.length === 0 ? (
                <EmptyState title="No available slots" description="All slots have been awarded." />
              ) : (
                <div className="space-y-2">
                  {availableForBid.map((slot) => {
                    const isSelected = selectedSlots.some((s) => s.slot_id === slot.slot_id)
                    return (
                      <button
                        key={slot.slot_id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleSlot(slot)}
                        className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-1.5">
                            {slot.shift_template_name}
                            {slot.label && (
                              <span className="text-muted-foreground">({slot.label})</span>
                            )}
                            {slot.is_flex && (
                              <Badge variant="outline" className="text-xs border-teal-300 text-teal-700 py-0 h-5">Flex</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {slot.team_name} · {formatTime(slot.start_time)} - {formatTime(slot.end_time)} · {slot.classification_name}
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {slot.days_of_week.map((d) => (
                            <span
                              key={d}
                              className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium w-7 h-5"
                            >
                              {DAY_LABELS[d]}
                            </span>
                          ))}
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {awardedSlots.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Already Awarded
                  </p>
                  <div className="space-y-1">
                    {awardedSlots.map((slot) => (
                      <div
                        key={slot.slot_id}
                        className="flex items-center gap-3 p-2 rounded-lg opacity-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-muted-foreground">
                            {slot.shift_template_name} · {slot.team_name}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">Taken</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Message for non-open states */}
      {status === 'upcoming' && (
        <EmptyState
          icon={<Clock className="w-12 h-12" />}
          title="Your bid window hasn't opened yet"
          description={`Your window opens ${formatDateTime(bidWindow.opens_at)}. Check back then to submit your shift preferences.`}
        />
      )}

      {status === 'closed' && !hasSubmissions && (
        <EmptyState
          icon={<Lock className="w-12 h-12" />}
          title="Your bid window has closed"
          description="The window for submitting your shift preferences has passed."
        />
      )}
    </div>
  )
}
