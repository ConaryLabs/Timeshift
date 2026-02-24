import { useState, useMemo } from 'react'
import { format, addDays } from 'date-fns'
import { Hand, Info, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
import { EmptyState } from '@/components/ui/empty-state'
import { DataTable, type Column } from '@/components/ui/data-table'
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
import { NO_VALUE } from '@/lib/format'
import type { CalloutListEntry, BumpRequest } from '@/api/callout'
import type { CalloutStep } from '@/api/ot'

const INITIAL_FORM = {
  scheduled_shift_id: NO_VALUE,
  classification_id: NO_VALUE,
  reason_text: '',
  ot_request_id: NO_VALUE,
}

type AcceptTarget = { user_id: string; name: string }

const CALLOUT_STEPS: { key: CalloutStep; label: string }[] = [
  { key: 'volunteers', label: 'Volunteers' },
  { key: 'low_ot_hours', label: 'Low OT Hours' },
  { key: 'inverse_seniority', label: 'Inverse Seniority' },
  { key: 'equal_ot_hours', label: 'Equal OT Hours' },
  { key: 'mandatory', label: 'Mandatory' },
]

const STEP_DESCRIPTIONS: Record<string, string> = {
  volunteers: 'Employees who volunteered for this shift',
  low_ot_hours: 'Employees sorted by lowest overtime hours first',
  inverse_seniority: 'Least senior employees contacted first',
  equal_ot_hours: 'Employees with equal OT hours, sorted by seniority',
  mandatory: 'Mandatory overtime assignment for remaining employees',
}

function StepIndicator({ currentStep }: { currentStep: CalloutStep | null }) {
  const activeIndex = currentStep
    ? CALLOUT_STEPS.findIndex((s) => s.key === currentStep)
    : -1

  return (
    <div className="flex items-center gap-1 flex-wrap mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-sm">
            The callout process contacts employees in order: first volunteers, then by lowest OT hours, inverse seniority, equal OT hours, and finally mandatory assignment.
          </TooltipContent>
        </Tooltip>
      </div>
      {CALLOUT_STEPS.map((step, i) => {
        const isActive = i === activeIndex
        const isPast = i < activeIndex
        return (
          <div key={step.key} className="flex items-center gap-1">
            {i > 0 && <div className={cn("w-4 h-px", isPast ? "bg-primary" : "bg-border")} />}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={isActive ? 'default' : isPast ? 'secondary' : 'outline'}
                  className={cn(
                    "text-xs whitespace-nowrap",
                    isActive && "ring-2 ring-primary/30",
                  )}
                >
                  {i + 1}. {step.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {STEP_DESCRIPTIONS[step.key]}
              </TooltipContent>
            </Tooltip>
          </div>
        )
      })}
    </div>
  )
}

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

  const today = format(new Date(), 'yyyy-MM-dd')
  const twoWeeksOut = format(addDays(new Date(), 14), 'yyyy-MM-dd')

  const { data: events, isLoading, isError } = useCalloutEvents()
  const { data: calloutList } = useCalloutList(selectedEvent ?? '')
  const { data: volunteers } = useCalloutVolunteers(selectedEvent ?? '')
  const cancelMut = useCancelCalloutEvent()
  const createMut = useCreateCalloutEvent()
  const recordMut = useRecordAttempt()
  const volunteerMut = useVolunteer()
  const advanceStepMut = useAdvanceCalloutStep()

  const { data: bumpRequests } = useBumpRequests(selectedEvent ?? '')
  const createBumpMut = useCreateBumpRequest()
  const reviewBumpMut = useReviewBumpRequest()

  const { data: scheduledShifts } = useScheduledShifts({ start_date: today, end_date: twoWeeksOut })
  const { data: templates } = useShiftTemplates()
  const { data: classifications } = useClassifications()
  const { data: otRequests } = useOtRequests({ status: 'open' })

  const templateMap = Object.fromEntries((templates ?? []).map((t) => [t.id, t]))

  const selectedEventData = (events ?? []).find((e) => e.id === selectedEvent)
  const eventIsOpen = selectedEventData?.status === 'open'
  const eventIsFilled = selectedEventData?.status === 'filled'
  const currentStep = selectedEventData?.current_step ?? null

  // Check if current user already volunteered
  const hasVolunteered = (volunteers ?? []).some((v) => v.user_id === user?.id)

  const filteredCalloutList = useMemo(() => {
    if (!calloutList || !debouncedSearch) return calloutList ?? []
    const q = debouncedSearch.toLowerCase()
    return calloutList.filter((r) =>
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
      `${r.last_name}, ${r.first_name}`.toLowerCase().includes(q)
    )
  }, [calloutList, debouncedSearch])

  function getNextStep(): CalloutStep | null {
    if (!currentStep) return 'volunteers'
    const idx = CALLOUT_STEPS.findIndex((s) => s.key === currentStep)
    if (idx < CALLOUT_STEPS.length - 1) return CALLOUT_STEPS[idx + 1].key
    return null
  }

  function handleAdvanceStep() {
    if (!selectedEvent) return
    const next = getNextStep()
    if (!next) return
    advanceStepMut.mutate(
      { eventId: selectedEvent, step: next },
      {
        onSuccess: () => toast.success('Advanced to next step'),
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to advance step'
          toast.error(msg)
        },
      },
    )
  }

  function handleVolunteer() {
    if (!selectedEvent) return
    volunteerMut.mutate(selectedEvent, {
      onSuccess: () => toast.success('Volunteered successfully'),
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to volunteer'
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
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to initiate callout'
          toast.error(msg)
        },
      },
    )
  }

  function recordResponse(userId: string, response: 'declined' | 'no_answer') {
    if (!selectedEvent) return
    recordMut.mutate(
      { eventId: selectedEvent, user_id: userId, response },
      {
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to record response'
          toast.error(msg)
        },
      },
    )
  }

  function handleAccept() {
    if (!acceptTarget || !selectedEvent) return
    recordMut.mutate(
      {
        eventId: selectedEvent,
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
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to confirm acceptance'
          toast.error(msg)
        },
      },
    )
  }

  function handleBumpSubmit() {
    if (!selectedEvent || bumpDisplacedUserId === NO_VALUE) return
    createBumpMut.mutate(
      { eventId: selectedEvent, displaced_user_id: bumpDisplacedUserId, reason: bumpReason || undefined },
      {
        onSuccess: () => {
          toast.success('Bump request submitted')
          setShowBumpDialog(false)
          setBumpDisplacedUserId(NO_VALUE)
          setBumpReason('')
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to submit bump request'
          toast.error(msg)
        },
      },
    )
  }

  function handleBumpReview(requestId: string, approved: boolean) {
    reviewBumpMut.mutate(
      { requestId, approved },
      {
        onSuccess: () => toast.success(approved ? 'Bump approved' : 'Bump rejected'),
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to review bump request'
          toast.error(msg)
        },
      },
    )
  }

  const pendingBumps = (bumpRequests ?? []).filter((b: BumpRequest) => b.status === 'pending')

  const calloutColumns: Column<CalloutListEntry>[] = [
    { header: '#', cell: (r) => <span className="font-semibold">{r.position}</span> },
    {
      header: 'Name',
      cell: (r) => (
        <div>
          {r.last_name}, {r.first_name}
          <span className="block text-xs text-muted-foreground">
            {r.classification_abbreviation}
            {r.is_cross_class && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 text-amber-700 border-amber-300">
                    cross-class
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  This employee is from a different classification and is eligible per LOU 25-10 (within the org's cross-classification window).
                </TooltipContent>
              </Tooltip>
            )}
          </span>
        </div>
      ),
    },
    { header: 'OT Hrs', cell: (r) => r.ot_hours.toFixed(1) },
    {
      header: 'Status',
      cell: (r) =>
        r.is_available ? (
          <span className="text-green-600 font-medium">Available</span>
        ) : (
          <span className="text-muted-foreground text-xs">{r.unavailable_reason}</span>
        ),
    },
    ...(isManager && eventIsOpen
      ? [{
          header: 'Contact',
          cell: (r: CalloutListEntry) => {
            const busy = recordMut.isPending && (recordMut.variables as { user_id: string } | undefined)?.user_id === r.user_id
            return (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 hover:bg-green-50"
                  disabled={recordMut.isPending}
                  aria-label={`Accept OT for ${r.first_name} ${r.last_name}`}
                  onClick={() => setAcceptTarget({ user_id: r.user_id, name: `${r.last_name}, ${r.first_name}` })}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700 hover:bg-red-50"
                  disabled={recordMut.isPending}
                  aria-label={`Record declined for ${r.first_name} ${r.last_name}`}
                  onClick={() => recordResponse(r.user_id, 'declined')}
                >
                  {busy && (recordMut.variables as { response: string } | undefined)?.response === 'declined' ? '…' : 'Decline'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recordMut.isPending}
                  aria-label={`Record no answer for ${r.first_name} ${r.last_name}`}
                  onClick={() => recordResponse(r.user_id, 'no_answer')}
                >
                  {busy && (recordMut.variables as { response: string } | undefined)?.response === 'no_answer' ? '…' : 'No Answer'}
                </Button>
              </div>
            )
          },
        }]
      : []),
  ]

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
          {isLoading && <LoadingState />}
          {!isLoading && isError && (
            <p className="text-sm text-destructive">Failed to load callout events.</p>
          )}
          {!isLoading && !isError && (events ?? []).length === 0 && (
            <EmptyState title="No callout events" description="Initiate a callout when coverage is needed." />
          )}
          <div className="space-y-2">
            {(events ?? []).map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setSelectedEvent(ev.id)}
                aria-label={`Callout event from ${new Date(ev.created_at).toLocaleDateString()}${ev.shift_template_name ? `, ${ev.shift_template_name}` : ''}`}
                className={cn(
                  "border rounded-lg p-3 cursor-pointer transition-colors w-full text-left",
                  selectedEvent === ev.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {new Date(ev.created_at).toLocaleDateString()}
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
          {selectedEvent && eventIsOpen && (
            <>
              {/* Step indicator */}
              <StepIndicator currentStep={currentStep} />

              {/* Controls row */}
              <div className="flex items-center gap-2 mb-4">
                {isManager && getNextStep() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAdvanceStep}
                    disabled={advanceStepMut.isPending}
                  >
                    Advance to: {CALLOUT_STEPS.find((s) => s.key === getNextStep())?.label}
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
            {selectedEvent ? 'Callout List' : 'Select an event'}
          </h3>
          {selectedEvent && (
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name..." className="w-56 mb-3" />
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
          {selectedEvent && eventIsFilled && (
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
                            onClick={() => handleBumpReview(b.id, true)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 hover:bg-red-50"
                            disabled={reviewBumpMut.isPending}
                            aria-label={`Reject bump by ${b.requesting_user_first_name} ${b.requesting_user_last_name}`}
                            onClick={() => handleBumpReview(b.id, false)}
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
      <Dialog open={showInitiate} onOpenChange={(open) => !open && setShowInitiate(false)}>
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
                  {(scheduledShifts ?? []).map((s) => {
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
              Initiate
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
              Confirm Acceptance
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
                  {(calloutList ?? [])
                    .filter((e) => e.user_id !== user?.id)
                    .map((e) => (
                      <SelectItem key={e.user_id} value={e.user_id}>
                        {e.last_name}, {e.first_name}
                      </SelectItem>
                    ))}
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
              Submit
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
                    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to cancel callout'
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
    </div>
  )
}
