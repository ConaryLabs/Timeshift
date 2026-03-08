// frontend/src/pages/CalloutPage.tsx
import { useState, useMemo } from 'react'
import { format, addDays } from 'date-fns'
import { Hand, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from '@/components/ui/search-input'
import { useDebounce } from '@/hooks/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTable } from '@/components/ui/data-table'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import {
  useCalloutEvents,
  useCalloutList,
  useCancelCalloutEvent,
  useCreateCalloutEvent,
  useRecordAttempt,
  useScheduledShifts,
  useShiftTemplates,
  useClassifications,
  useCalloutVolunteers,
  useVolunteer,
  useAdvanceCalloutStep,
  useBumpRequests,
  useCreateBumpRequest,
  useReviewBumpRequest,
  useOtRequests,
} from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { NO_VALUE, extractApiError, formatDate } from '@/lib/format'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import { StepIndicator } from '@/components/callout/StepIndicator'
import { CALLOUT_STEPS, getNextStep as getNextCalloutStep, getPrevStep as getPrevCalloutStep } from '@/components/callout/calloutSteps'
import { useCalloutColumns } from '@/components/callout/CalloutListTable'
import type { CalloutEvent, BumpRequest } from '@/api/callout'
import type { CalloutStep } from '@/api/ot'

type CalloutStatusFilter = CalloutEvent['status'] | 'all'

const STATUS_TABS: { label: string; value: CalloutStatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Filled', value: 'filled' },
  { label: 'Cancelled', value: 'cancelled' },
]

const INITIAL_FORM = {
  scheduled_shift_id: NO_VALUE,
  classification_id: NO_VALUE,
  reason_text: '',
  ot_request_id: NO_VALUE,
}

type AcceptTarget = { user_id: string; name: string }

export default function CalloutPage() {
  const { isManager } = usePermissions()
  const user = useAuthStore((s) => s.user)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [showInitiate, setShowInitiate] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [acceptTarget, setAcceptTarget] = useState<AcceptTarget | null>(null)
  const [acceptNotes, setAcceptNotes] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [showBumpDialog, setShowBumpDialog] = useState(false)
  const [bumpDisplacedUserId, setBumpDisplacedUserId] = useState(NO_VALUE)
  const [bumpReason, setBumpReason] = useState('')
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<CalloutStatusFilter>('all')
  const [classificationFilter, setClassificationFilter] = useState(NO_VALUE)
  const [bumpReviewTarget, setBumpReviewTarget] = useState<{ id: string; approve: boolean; name: string } | null>(null)

  const { confirmClose, confirmDialog } = useConfirmClose()

  const isCalloutFormDirty = form.scheduled_shift_id !== NO_VALUE || form.classification_id !== NO_VALUE || form.reason_text !== ''

  const today = format(new Date(), 'yyyy-MM-dd')
  const twoWeeksOut = format(addDays(new Date(), 14), 'yyyy-MM-dd')

  const { data: events, isLoading, isError, refetch } = useCalloutEvents()

  // Auto-select the only open event when the list loads (derived, no effect needed)
  const autoSelectedEvent = useMemo(() => {
    if (!events) return null
    const openEvents = events.filter((e) => e.status === 'open')
    return openEvents.length === 1 ? openEvents[0].id : null
  }, [events])
  const effectiveSelectedEvent = selectedEvent ?? autoSelectedEvent

  const { data: calloutList } = useCalloutList(effectiveSelectedEvent ?? '')
  const { data: volunteers } = useCalloutVolunteers(effectiveSelectedEvent ?? '')
  const cancelMut = useCancelCalloutEvent()
  const createMut = useCreateCalloutEvent()
  const recordMut = useRecordAttempt()
  const volunteerMut = useVolunteer()
  const advanceStepMut = useAdvanceCalloutStep()

  const { data: bumpRequests } = useBumpRequests(effectiveSelectedEvent ?? '')
  const createBumpMut = useCreateBumpRequest()
  const reviewBumpMut = useReviewBumpRequest()

  const { data: scheduledShifts } = useScheduledShifts({ start_date: today, end_date: twoWeeksOut })
  const { data: templates } = useShiftTemplates()
  const { data: classifications } = useClassifications()
  const { data: otRequests } = useOtRequests({ status: 'open' })

  const templateMap = Object.fromEntries((templates ?? []).map((t) => [t.id, t]))

  // Sort scheduled shifts so today's shifts appear first
  const sortedShifts = useMemo(() => {
    const shifts = scheduledShifts ?? []
    return [...shifts].sort((a, b) => {
      const aIsToday = a.date === today ? 0 : 1
      const bIsToday = b.date === today ? 0 : 1
      if (aIsToday !== bIsToday) return aIsToday - bIsToday
      return a.date.localeCompare(b.date) || (templateMap[a.shift_template_id]?.name ?? '').localeCompare(templateMap[b.shift_template_id]?.name ?? '')
    })
  }, [scheduledShifts, today, templateMap])

  const selectedEventData = (events ?? []).find((e) => e.id === effectiveSelectedEvent)
  const eventIsOpen = selectedEventData?.status === 'open'
  const eventIsFilled = selectedEventData?.status === 'filled'
  const currentStep = selectedEventData?.current_step ?? null

  // Check if current user already volunteered
  const hasVolunteered = (volunteers ?? []).some((v) => v.user_id === user?.id)

  // Filter + sort events
  const filteredEvents = useMemo(() => {
    let result = events ?? []
    if (statusFilter !== 'all') {
      result = result.filter((e) => e.status === statusFilter)
    }
    if (classificationFilter !== NO_VALUE) {
      result = result.filter((e) => e.classification_id === classificationFilter)
    }
    // Sort by created_at descending (most recent first)
    return [...result].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [events, statusFilter, classificationFilter])

  const filteredCalloutList = useMemo(() => {
    if (!calloutList || !debouncedSearch) return calloutList ?? []
    const q = debouncedSearch.toLowerCase()
    return calloutList.filter((r) =>
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
      `${r.last_name}, ${r.first_name}`.toLowerCase().includes(q)
    )
  }, [calloutList, debouncedSearch])

  function handleSetStep(step: CalloutStep) {
    if (!effectiveSelectedEvent) return
    advanceStepMut.mutate(
      { eventId: effectiveSelectedEvent, step },
      {
        onSuccess: () => toast.success(`Moved to ${CALLOUT_STEPS.find((s) => s.key === step)?.label}`),
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to change step')
          toast.error(msg)
        },
      },
    )
  }

  function handleVolunteer() {
    if (!effectiveSelectedEvent) return
    volunteerMut.mutate(effectiveSelectedEvent, {
      onSuccess: () => toast.success('Volunteered successfully'),
      onError: (err: unknown) => {
        const msg = extractApiError(err, 'Failed to volunteer')
        toast.error(msg)
      },
    })
  }

  function handleInitiate() {
    if (form.scheduled_shift_id === NO_VALUE || form.classification_id === NO_VALUE) return
    createMut.mutate(
      {
        scheduled_shift_id: form.scheduled_shift_id,
        classification_id: form.classification_id,
        reason_text: form.reason_text || undefined,
        ot_request_id: form.ot_request_id !== NO_VALUE ? form.ot_request_id : undefined,
      },
      {
        onSuccess: (ev) => {
          toast.success('Callout initiated')
          setShowInitiate(false)
          setForm(INITIAL_FORM)
          setSelectedEvent(ev.id)
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to initiate callout')
          toast.error(msg)
        },
      },
    )
  }

  function recordResponse(userId: string, response: 'declined' | 'no_answer') {
    if (!effectiveSelectedEvent) return
    recordMut.mutate(
      { eventId: effectiveSelectedEvent, user_id: userId, response },
      {
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to record response')
          toast.error(msg)
        },
      },
    )
  }

  function handleAccept() {
    if (!acceptTarget || !effectiveSelectedEvent) return
    recordMut.mutate(
      {
        eventId: effectiveSelectedEvent,
        user_id: acceptTarget.user_id,
        response: 'accepted',
        notes: acceptNotes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Acceptance confirmed')
          setAcceptTarget(null)
          setAcceptNotes('')
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to confirm acceptance')
          toast.error(msg)
        },
      },
    )
  }

  function handleBumpSubmit() {
    if (!effectiveSelectedEvent || bumpDisplacedUserId === NO_VALUE) return
    createBumpMut.mutate(
      { eventId: effectiveSelectedEvent, displaced_user_id: bumpDisplacedUserId, reason: bumpReason || undefined },
      {
        onSuccess: () => {
          toast.success('Bump request submitted')
          setShowBumpDialog(false)
          setBumpDisplacedUserId(NO_VALUE)
          setBumpReason('')
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to submit bump request')
          toast.error(msg)
        },
      },
    )
  }

  function handleBumpReview(requestId: string, approved: boolean) {
    reviewBumpMut.mutate(
      { requestId, approved },
      {
        onSuccess: () => toast.success(approved ? 'Bump approved' : 'Bump denied'),
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to review bump request')
          toast.error(msg)
        },
      },
    )
  }

  const pendingBumps = (bumpRequests ?? []).filter((b: BumpRequest) => b.status === 'pending')

  const calloutColumns = useCalloutColumns({
    isManager,
    eventIsOpen,
    recordMut,
    onAccept: (r) => setAcceptTarget({ user_id: r.user_id, name: `${r.last_name}, ${r.first_name}` }),
    onDecline: (userId) => recordResponse(userId, 'declined'),
    onNoAnswer: (userId) => recordResponse(userId, 'no_answer'),
  })

  return (
    <div>
      <PageHeader
        title="Callout"
        actions={
          isManager ? (
            <Button onClick={() => setShowInitiate(true)}>+ Initiate Callout</Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Events list */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Events</h3>

          {/* Status filter tabs + classification filter */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex gap-1">
              {STATUS_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  size="sm"
                  variant={statusFilter === tab.value ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <Select
              value={classificationFilter}
              onValueChange={setClassificationFilter}
            >
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="All classifications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VALUE}>All classifications</SelectItem>
                {(classifications ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.abbreviation})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && <LoadingState />}
          {!isLoading && isError && (
            <ErrorState message="Failed to load callout events." onRetry={() => refetch()} />
          )}
          {!isLoading && !isError && filteredEvents.length === 0 && (
            <EmptyState
              title="No callout events"
              description={statusFilter !== 'all' || classificationFilter !== NO_VALUE
                ? 'No events match the current filters.'
                : 'Initiate a callout when coverage is needed.'}
            />
          )}
          <div className="space-y-2">
            {filteredEvents.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setSelectedEvent(ev.id)}
                aria-label={`Callout event from ${formatDate(ev.created_at)}${ev.shift_template_name ? `, ${ev.shift_template_name}` : ''}`}
                className={cn(
                  "border rounded-lg p-3 cursor-pointer transition-colors w-full text-left",
                  effectiveSelectedEvent === ev.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {formatDate(ev.created_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    {ev.current_step && ev.status === 'open' && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {ev.current_step.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    <StatusBadge status={ev.status} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">{ev.classification_name}</span>
                  {(ev.shift_template_name || ev.team_name) && (
                    <> — {[ev.team_name, ev.shift_template_name].filter(Boolean).join(' — ')}</>
                  )}
                  {ev.shift_date && ` (${ev.shift_date})`}
                </p>
                {ev.ot_request_id && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Linked OT Request: <span className="font-medium">{ev.ot_request_id.slice(0, 8)}...</span>
                  </p>
                )}
                {ev.reason_text && (
                  <p className="text-xs text-muted-foreground mt-1">{ev.reason_text}</p>
                )}
                {isManager && ev.status === 'open' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCancelTarget(ev.id)
                    }}
                  >
                    Cancel event
                  </Button>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Callout list + step indicator */}
        <div>
          {effectiveSelectedEvent && eventIsOpen && (
            <>
              {/* Step indicator */}
              <StepIndicator currentStep={currentStep} />

              {/* Controls row */}
              <div className="flex items-center gap-2 mb-4">
                {isManager && getPrevCalloutStep(currentStep) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetStep(getPrevCalloutStep(currentStep)!)}
                    disabled={advanceStepMut.isPending}
                  >
                    Back to: {CALLOUT_STEPS.find((s) => s.key === getPrevCalloutStep(currentStep))?.label}
                  </Button>
                )}
                {isManager && getNextCalloutStep(currentStep) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetStep(getNextCalloutStep(currentStep)!)}
                    disabled={advanceStepMut.isPending}
                  >
                    Advance to: {CALLOUT_STEPS.find((s) => s.key === getNextCalloutStep(currentStep))?.label}
                  </Button>
                )}
                {!isManager && !hasVolunteered && (
                  <Button
                    size="sm"
                    onClick={handleVolunteer}
                    disabled={volunteerMut.isPending}
                  >
                    <Hand className="h-4 w-4 mr-1" />
                    Volunteer
                  </Button>
                )}
                {!isManager && hasVolunteered && (
                  <Badge variant="secondary">You have volunteered</Badge>
                )}
              </div>

              {/* Volunteers section */}
              {(volunteers ?? []).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Volunteers ({(volunteers ?? []).length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {(volunteers ?? []).map((v) => (
                      <Badge key={v.id} variant="secondary" className="text-xs">
                        {v.last_name}, {v.first_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {effectiveSelectedEvent ? 'Callout List' : 'Select an event'}
          </h3>
          {effectiveSelectedEvent && (
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name..." className="w-64 mb-3" />
          )}
          {calloutList && (
            <DataTable
              columns={calloutColumns}
              data={filteredCalloutList}
              rowKey={(r) => r.user_id}
              emptyMessage="No entries in callout list"
            />
          )}

          {/* Bump request section — visible when event is filled */}
          {effectiveSelectedEvent && eventIsFilled && (
            <div className="mt-6">
              {/* Employee: Request Bump button */}
              {!isManager && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBumpDialog(true)}
                  aria-label="Request bump"
                >
                  <ArrowUpDown className="h-4 w-4 mr-1" />
                  Request Bump
                </Button>
              )}

              {/* Supervisor: Pending bump requests panel */}
              {isManager && pendingBumps.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-3">
                    Pending Bump Requests ({pendingBumps.length})
                  </h4>
                  <div className="space-y-3">
                    {pendingBumps.map((b: BumpRequest) => (
                      <div key={b.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm">
                            <span className="font-medium">
                              {b.requesting_user_last_name}, {b.requesting_user_first_name}
                            </span>
                            {' wants to bump '}
                            <span className="font-medium">
                              {b.displaced_user_last_name}, {b.displaced_user_first_name}
                            </span>
                          </div>
                        </div>
                        {b.reason && (
                          <p className="text-xs text-muted-foreground mt-1">{b.reason}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 hover:bg-green-50"
                            disabled={reviewBumpMut.isPending}
                            aria-label={`Approve bump by ${b.requesting_user_first_name} ${b.requesting_user_last_name}`}
                            onClick={() => setBumpReviewTarget({ id: b.id, approve: true, name: `${b.requesting_user_first_name} ${b.requesting_user_last_name}` })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 hover:bg-red-50"
                            disabled={reviewBumpMut.isPending}
                            aria-label={`Reject bump by ${b.requesting_user_first_name} ${b.requesting_user_last_name}`}
                            onClick={() => setBumpReviewTarget({ id: b.id, approve: false, name: `${b.requesting_user_first_name} ${b.requesting_user_last_name}` })}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Initiate callout dialog */}
      <Dialog open={showInitiate} onOpenChange={(open) => { if (!open) confirmClose(isCalloutFormDirty, () => { setShowInitiate(false); setForm(INITIAL_FORM) }) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Callout</DialogTitle>
            <DialogDescription>
              Select the shift that needs coverage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FormField label="Shift" htmlFor="callout-shift" required>
              <Select
                value={form.scheduled_shift_id}
                onValueChange={(v) => setForm({ ...form, scheduled_shift_id: v })}
              >
                <SelectTrigger id="callout-shift">
                  <SelectValue placeholder="Select a shift…" />
                </SelectTrigger>
                <SelectContent>
                  {sortedShifts.map((s) => {
                    const tmpl = templateMap[s.shift_template_id]
                    const label = tmpl ? `${s.date} — ${tmpl.name}` : s.date
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="OT List (Classification)" htmlFor="callout-class" required>
              <Select
                value={form.classification_id}
                onValueChange={(v) => setForm({ ...form, classification_id: v })}
              >
                <SelectTrigger id="callout-class">
                  <SelectValue placeholder="Select OT list…" />
                </SelectTrigger>
                <SelectContent>
                  {(classifications ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Link OT Request" htmlFor="callout-ot-request">
              <Select
                value={form.ot_request_id}
                onValueChange={(v) => setForm({ ...form, ot_request_id: v })}
              >
                <SelectTrigger id="callout-ot-request">
                  <SelectValue placeholder="None (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VALUE}>None</SelectItem>
                  {(otRequests ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.date} {r.start_time}-{r.end_time} ({r.classification_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Reason" htmlFor="callout-reason">
              <Textarea
                id="callout-reason"
                value={form.reason_text}
                onChange={(e) => setForm({ ...form, reason_text: e.target.value })}
                placeholder="Optional reason for the callout…"
                rows={3}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitiate(false)}>Cancel</Button>
            <Button
              onClick={handleInitiate}
              disabled={form.scheduled_shift_id === NO_VALUE || form.classification_id === NO_VALUE || createMut.isPending}
            >
              {createMut.isPending ? 'Initiating...' : 'Initiate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept confirmation dialog */}
      <Dialog open={!!acceptTarget} onOpenChange={(open) => !open && setAcceptTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Acceptance</DialogTitle>
            <DialogDescription>
              <strong>{acceptTarget?.name}</strong> has accepted the OT shift.
              This will mark the callout event as filled and create an OT assignment.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Notes" htmlFor="accept-notes">
            <Textarea
              id="accept-notes"
              value={acceptNotes}
              onChange={(e) => setAcceptNotes(e.target.value)}
              placeholder="Optional notes…"
              rows={2}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptTarget(null)}>Cancel</Button>
            <Button onClick={handleAccept} disabled={recordMut.isPending}>
              {recordMut.isPending ? 'Confirming...' : 'Confirm Acceptance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bump request dialog */}
      <Dialog open={showBumpDialog} onOpenChange={(open) => {
        if (!open) {
          setShowBumpDialog(false)
          setBumpDisplacedUserId(NO_VALUE)
          setBumpReason('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Bump</DialogTitle>
            <DialogDescription>
              Submit a bump request to displace an employee from the filled OT assignment.
              You must have higher OT priority than the displaced employee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FormField label="Employee to Displace" htmlFor="bump-displaced" required>
              <Select
                value={bumpDisplacedUserId}
                onValueChange={setBumpDisplacedUserId}
              >
                <SelectTrigger id="bump-displaced">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {selectedEventData?.assigned_user_id && selectedEventData.assigned_user_id !== user?.id && (
                    <SelectItem value={selectedEventData.assigned_user_id}>
                      {selectedEventData.assigned_user_name ?? 'Assigned employee'}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Reason" htmlFor="bump-reason">
              <Textarea
                id="bump-reason"
                value={bumpReason}
                onChange={(e) => setBumpReason(e.target.value)}
                placeholder="Optional reason for the bump request…"
                rows={3}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBumpDialog(false)}>Cancel</Button>
            <Button
              onClick={handleBumpSubmit}
              disabled={bumpDisplacedUserId === NO_VALUE || createBumpMut.isPending}
            >
              {createBumpMut.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Callout Event</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const ev = (events ?? []).find((e) => e.id === cancelTarget)
                return ev
                  ? `Are you sure you want to cancel the ${ev.classification_name} callout${ev.shift_date ? ` on ${ev.shift_date}` : ''}${ev.shift_template_name ? ` (${ev.shift_template_name})` : ''}? This action cannot be undone.`
                  : 'Are you sure you want to cancel this callout event?'
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep Open
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMut.isPending}
              onClick={() => {
                if (!cancelTarget) return
                cancelMut.mutate(cancelTarget, {
                  onSuccess: () => {
                    toast.success('Callout cancelled')
                    setSelectedEvent(null)
                    setCancelTarget(null)
                  },
                  onError: (err: unknown) => {
                    const msg = extractApiError(err, 'Failed to cancel callout')
                    toast.error(msg)
                  },
                })
              }}
            >
              Cancel Event
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bump review confirmation dialog */}
      <AlertDialog open={!!bumpReviewTarget} onOpenChange={(open) => { if (!open) setBumpReviewTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bumpReviewTarget?.approve ? 'Approve Bump Request' : 'Reject Bump Request'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bumpReviewTarget?.approve
                ? `Are you sure you want to approve the bump request from ${bumpReviewTarget.name}?`
                : `Are you sure you want to reject the bump request from ${bumpReviewTarget?.name}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBumpReviewTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={bumpReviewTarget?.approve ? 'default' : 'destructive'}
              disabled={reviewBumpMut.isPending}
              onClick={() => {
                if (!bumpReviewTarget) return
                handleBumpReview(bumpReviewTarget.id, bumpReviewTarget.approve)
                setBumpReviewTarget(null)
              }}
            >
              {bumpReviewTarget?.approve ? 'Approve' : 'Reject'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {confirmDialog}
    </div>
  )
}
