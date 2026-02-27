import { useState, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, Phone as PhoneIcon, Megaphone, Plus, ChevronRight, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SearchInput } from '@/components/ui/search-input'
import { useDebounce } from '@/hooks/useDebounce'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTable } from '@/components/ui/data-table'
import { StepIndicator } from '@/components/callout/StepIndicator'
import { CALLOUT_STEPS } from '@/components/callout/calloutSteps'
import { useCalloutColumns } from '@/components/callout/CalloutListTable'
import MandatoryOTDialog from '@/components/coverage/MandatoryOTDialog'
import DayOffMandatoryDialog from '@/components/coverage/DayOffMandatoryDialog'
import SmsAlertDialog from '@/components/coverage/SmsAlertDialog'
import {
  useStaffingAvailable,
  useCoverageGaps,
  useCreateCalloutEvent,
  useCalloutList,
  useRecordAttempt,
  useAdvanceCalloutStep,
  useCalloutVolunteers,
  useCreateOtRequest,
  useClassifications,
} from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { extractApiError } from '@/lib/format'
import type { CalloutListEntry } from '@/api/callout'
import type { CalloutStep } from '@/api/ot'
import type { ClassificationGap } from '@/api/coveragePlans'

type AcceptTarget = { user_id: string; name: string }

export default function StaffingResolvePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isManager } = usePermissions()

  // URL params
  const date = searchParams.get('date') ?? ''
  const shiftTemplateId = searchParams.get('shift_template_id') ?? ''
  const classificationId = searchParams.get('classification_id') ?? undefined

  // UI state
  const [acceptTarget, setAcceptTarget] = useState<AcceptTarget | null>(null)
  const [acceptNotes, setAcceptNotes] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [showSmsDialog, setShowSmsDialog] = useState(false)
  const [mandatoryGap, setMandatoryGap] = useState<ClassificationGap | null>(null)
  const [showDayOffDialog, setShowDayOffDialog] = useState(false)
  const [showCreateOt, setShowCreateOt] = useState(false)
  const [otNotes, setOtNotes] = useState('')

  // Data fetching
  const { data: staffing, isLoading, isError } = useStaffingAvailable(date, shiftTemplateId, classificationId)
  const { data: allGaps } = useCoverageGaps(date, { enabled: !!date })
  const { data: classifications } = useClassifications()

  const activeCallout = staffing?.existing_callout
  const activeCalloutId = activeCallout?.id ?? ''
  const { data: calloutList } = useCalloutList(activeCalloutId)
  const { data: volunteers } = useCalloutVolunteers(activeCalloutId)

  // Mutations
  const createCalloutMut = useCreateCalloutEvent()
  const recordMut = useRecordAttempt()
  const advanceStepMut = useAdvanceCalloutStep()
  const createOtMut = useCreateOtRequest()

  // Derived
  const currentStep = activeCallout?.current_step ?? null
  const calloutIsOpen = activeCallout?.status === 'open'

  // Filtered callout list
  const filteredCalloutList = useMemo(() => {
    if (!calloutList || !debouncedSearch) return calloutList ?? []
    const q = debouncedSearch.toLowerCase()
    return calloutList.filter((r) =>
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
      `${r.last_name}, ${r.first_name}`.toLowerCase().includes(q)
    )
  }, [calloutList, debouncedSearch])

  // Available employees from staffing response
  const employees = staffing?.employees ?? []

  // Other gaps on same date, excluding current shift+classification
  const otherGaps = useMemo(() => {
    if (!allGaps) return []
    return allGaps.filter((g) => {
      if (g.shift_template_id === shiftTemplateId && g.classification_id === classificationId) return false
      return g.shortage > 0
    })
  }, [allGaps, shiftTemplateId, classificationId])

  // Current gap info
  const currentGap = useMemo(() => {
    if (!allGaps || !classificationId) return null
    return allGaps.find(
      (g) => g.shift_template_id === shiftTemplateId && g.classification_id === classificationId
    ) ?? null
  }, [allGaps, shiftTemplateId, classificationId])

  // Gaps for current shift (for classification picker)
  const shiftGaps = useMemo(() => {
    if (!allGaps) return []
    return allGaps.filter((g) => g.shift_template_id === shiftTemplateId && g.shortage > 0)
  }, [allGaps, shiftTemplateId])

  // Classification lookup
  const classificationMap = useMemo(
    () => Object.fromEntries((classifications ?? []).map((c) => [c.id, c])),
    [classifications],
  )

  // Callout columns via shared hook
  const calloutColumns = useCalloutColumns({
    isManager,
    eventIsOpen: calloutIsOpen,
    recordMut,
    onAccept: (r: CalloutListEntry) =>
      setAcceptTarget({ user_id: r.user_id, name: `${r.last_name}, ${r.first_name}` }),
    onDecline: (userId: string) => handleRecordResponse(userId, 'declined'),
    onNoAnswer: (userId: string) => handleRecordResponse(userId, 'no_answer'),
  })

  function getNextStep(): CalloutStep | null {
    if (!currentStep) return 'volunteers'
    const idx = CALLOUT_STEPS.findIndex((s) => s.key === currentStep)
    if (idx < CALLOUT_STEPS.length - 1) return CALLOUT_STEPS[idx + 1].key
    return null
  }

  function handleStartCallout() {
    if (!staffing?.scheduled_shift_id || !classificationId) return
    createCalloutMut.mutate(
      {
        scheduled_shift_id: staffing.scheduled_shift_id,
        classification_id: classificationId,
      },
      {
        onSuccess: () => toast.success('Callout started'),
        onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to start callout')),
      },
    )
  }

  function handleAdvanceStep() {
    if (!activeCalloutId) return
    const next = getNextStep()
    if (!next) return
    advanceStepMut.mutate(
      { eventId: activeCalloutId, step: next },
      {
        onSuccess: () => toast.success('Advanced to next step'),
        onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to advance step')),
      },
    )
  }

  function handleRecordResponse(userId: string, response: 'declined' | 'no_answer') {
    if (!activeCalloutId) return
    recordMut.mutate(
      { eventId: activeCalloutId, user_id: userId, response },
      {
        onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to record response')),
      },
    )
  }

  function handleAccept() {
    if (!acceptTarget || !activeCalloutId) return
    recordMut.mutate(
      {
        eventId: activeCalloutId,
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
        onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to confirm acceptance')),
      },
    )
  }

  function handleCreateOtRequest() {
    if (!classificationId || !staffing) return
    createOtMut.mutate(
      {
        date,
        start_time: staffing.shift_start_time,
        end_time: staffing.shift_end_time,
        classification_id: classificationId,
        is_fixed_coverage: false,
        notes: otNotes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('OT request created')
          setShowCreateOt(false)
          setOtNotes('')
        },
        onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to create OT request')),
      },
    )
  }

  function navigateToGap(gap: ClassificationGap) {
    setSearchParams({
      date,
      shift_template_id: gap.shift_template_id,
      classification_id: gap.classification_id,
    })
  }

  // If no date or shift_template_id, show an error
  if (!date || !shiftTemplateId) {
    return (
      <div>
        <PageHeader title="Resolve Staffing Gap" />
        <EmptyState
          title="Missing parameters"
          description="This page requires a date and shift template. Navigate here from the schedule or coverage gaps view."
        />
      </div>
    )
  }

  // If no classification selected, show a picker
  if (!classificationId && !isLoading) {
    return (
      <div>
        <PageHeader
          title="Resolve Staffing Gap"
          description={`${format(new Date(date + 'T12:00:00'), 'EEEE, MMM d, yyyy')}`}
        />
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Classification</CardTitle>
          </CardHeader>
          <CardContent>
            {shiftGaps.length > 0 ? (
              <div className="space-y-2">
                {shiftGaps.map((g) => (
                  <button
                    key={g.classification_id}
                    type="button"
                    className="w-full flex items-center justify-between border rounded-lg p-3 hover:bg-accent/50 transition-colors text-left"
                    onClick={() => navigateToGap(g)}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: g.shift_color }}
                      />
                      <div>
                        <span className="font-medium text-sm">{g.shift_name}</span>
                        <span className="ml-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {g.classification_abbreviation}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-destructive font-medium text-sm tabular-nums">
                        {g.actual}/{g.target}
                      </span>
                      <span className="text-muted-foreground text-xs">(need {g.shortage})</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No gaps found"
                description="No staffing gaps detected for this shift on this date."
              />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const classInfo = classificationId ? classificationMap[classificationId] : null
  const formattedDate = date ? format(new Date(date + 'T12:00:00'), 'EEE, MMM d, yyyy') : ''

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-3 flex-wrap">
          {staffing && (
            <h1 className="text-2xl font-semibold tracking-tight">
              {staffing.shift_template_name}
            </h1>
          )}
          <span className="text-muted-foreground">{formattedDate}</span>
          {staffing && (
            <span className="text-sm text-muted-foreground">
              {staffing.shift_start_time} &ndash; {staffing.shift_end_time}
            </span>
          )}
        </div>
        {currentGap && (
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
              {currentGap.classification_abbreviation}
            </span>
            <span className="text-destructive font-medium text-sm tabular-nums">
              {currentGap.actual}/{currentGap.target} staffed
            </span>
            <span className="text-muted-foreground text-sm">(need {currentGap.shortage} more)</span>
          </div>
        )}
        {!currentGap && classInfo && (
          <p className="text-sm text-muted-foreground mt-1">
            {classInfo.name} ({classInfo.abbreviation})
          </p>
        )}
      </div>

      {isLoading && <LoadingState />}
      {isError && (
        <EmptyState
          title="Failed to load staffing data"
          description="Try refreshing the page or go back to the schedule."
        />
      )}

      {staffing && (
        <div className="space-y-6">
          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {!activeCallout && (
              <Button
                onClick={handleStartCallout}
                disabled={createCalloutMut.isPending}
              >
                <PhoneIcon className="h-4 w-4 mr-1" />
                {createCalloutMut.isPending ? 'Starting...' : 'Start Callout'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowSmsDialog(true)}>
              <Megaphone className="h-4 w-4 mr-1" />
              Send SMS Alert
            </Button>
            <Button variant="outline" onClick={() => setShowCreateOt(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create OT Request
            </Button>
            {currentGap && (
              <Button variant="outline" onClick={() => setMandatoryGap(currentGap)}>
                <AlertTriangle className="h-4 w-4 mr-1" />
                Mandate On-Shift
              </Button>
            )}
            {classificationId && staffing && (
              <Button variant="outline" onClick={() => setShowDayOffDialog(true)}>
                <AlertTriangle className="h-4 w-4 mr-1" />
                Mandate Day Off
              </Button>
            )}
          </div>

          {/* Active Callout Panel */}
          {activeCallout && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    Active Callout
                    <StatusBadge status={activeCallout.status} />
                  </CardTitle>
                  <Link
                    to="/callout"
                    className="text-sm text-primary hover:underline"
                  >
                    View Full Callout
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {calloutIsOpen && (
                  <>
                    <StepIndicator currentStep={currentStep} />
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
                    </div>

                    {/* Volunteers */}
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

                    {/* Callout list */}
                    <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="Search callout list..."
                      className="w-56 mb-3"
                    />
                    <DataTable
                      columns={calloutColumns}
                      data={filteredCalloutList}
                      rowKey={(r) => r.user_id}
                      emptyMessage="No entries in callout list"
                    />
                  </>
                )}
                {!calloutIsOpen && (
                  <p className="text-sm text-muted-foreground">
                    Callout is {activeCallout.status}.
                    {activeCallout.status === 'filled' && ' A position has been filled.'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Existing OT Requests */}
          {staffing.existing_ot_requests.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Open OT Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {staffing.existing_ot_requests.map((req) => (
                    <Link
                      key={req.id}
                      to={`/ot-requests/${req.id}`}
                      className="flex items-center justify-between border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <StatusBadge status={req.status} />
                        <span className="text-sm">
                          {req.start_time} &ndash; {req.end_time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{req.volunteer_count} volunteers</span>
                        <span>{req.assignment_count} assigned</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Employees */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Available Employees ({employees.filter((e) => e.is_available).length}/{employees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <EmptyState
                  title="No employees found"
                  description="No employees in the OT queue for this classification."
                />
              ) : (
                <DataTable
                  columns={[
                    { header: '#', cell: (r) => <span className="font-semibold tabular-nums">{r.position}</span> },
                    {
                      header: 'Name',
                      cell: (r) => (
                        <div>
                          <span className={cn(!r.is_available && 'text-muted-foreground')}>
                            {r.last_name}, {r.first_name}
                          </span>
                          {r.is_cross_class && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 text-amber-700 border-amber-300">
                                  cross-class
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                From a different classification, eligible for cross-class OT.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ),
                    },
                    {
                      header: 'Class',
                      cell: (r) => (
                        <span className="font-mono text-xs">{r.classification_abbreviation}</span>
                      ),
                    },
                    { header: 'OT Hrs', cell: (r) => <span className="tabular-nums">{r.ot_hours.toFixed(1)}</span> },
                    {
                      header: 'Phone',
                      cell: (r) =>
                        r.phone ? (
                          <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                            <PhoneIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            {r.phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        ),
                    },
                    {
                      header: 'Status',
                      cell: (r) =>
                        r.is_available ? (
                          <span className="text-green-600 font-medium text-sm">Available</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">{r.unavailable_reason}</span>
                        ),
                    },
                  ]}
                  data={employees}
                  rowKey={(r) => r.user_id}
                  emptyMessage="No employees in queue"
                />
              )}
            </CardContent>
          </Card>

          {/* Other Gaps Today */}
          {otherGaps.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Other Gaps Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {otherGaps.map((g) => (
                    <button
                      key={`${g.shift_template_id}-${g.classification_id}`}
                      type="button"
                      className="w-full flex items-center justify-between border rounded-lg p-3 hover:bg-accent/50 transition-colors text-left"
                      onClick={() => navigateToGap(g)}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: g.shift_color }}
                        />
                        <span className="text-sm font-medium">{g.shift_name}</span>
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {g.classification_abbreviation}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-destructive font-medium text-sm tabular-nums">
                          &minus;{g.shortage}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
              placeholder="Optional notes..."
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

      {/* Create OT Request dialog */}
      <Dialog open={showCreateOt} onOpenChange={setShowCreateOt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create OT Request</DialogTitle>
            <DialogDescription>
              Post an OT request for employees to volunteer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Date:</span>{' '}
                <span className="font-medium">{formattedDate}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time:</span>{' '}
                <span className="font-medium">
                  {staffing?.shift_start_time} &ndash; {staffing?.shift_end_time}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Classification:</span>{' '}
                <span className="font-medium">{classInfo?.abbreviation ?? classificationId}</span>
              </div>
            </div>
            <FormField label="Notes" htmlFor="ot-notes">
              <Textarea
                id="ot-notes"
                value={otNotes}
                onChange={(e) => setOtNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateOt(false)}>Cancel</Button>
            <Button onClick={handleCreateOtRequest} disabled={createOtMut.isPending}>
              {createOtMut.isPending ? 'Creating...' : 'Create Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Alert dialog */}
      <SmsAlertDialog
        date={date}
        gaps={allGaps ?? []}
        open={showSmsDialog}
        onOpenChange={setShowSmsDialog}
      />

      {/* Mandatory OT dialog (on-shift: holdover / early callout) */}
      {mandatoryGap && (
        <MandatoryOTDialog
          gap={mandatoryGap}
          date={date}
          open={!!mandatoryGap}
          onOpenChange={(open) => !open && setMandatoryGap(null)}
        />
      )}

      {/* Day-off mandatory OT dialog */}
      {staffing && classificationId && (
        <DayOffMandatoryDialog
          date={date}
          defaultStartTime={staffing.shift_start_time}
          classificationId={classificationId}
          classificationAbbreviation={classInfo?.abbreviation ?? classificationId}
          employees={employees.filter((e) => e.is_available)}
          open={showDayOffDialog}
          onOpenChange={setShowDayOffDialog}
        />
      )}
    </div>
  )
}
