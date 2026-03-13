// frontend/src/pages/schedule/ActionPanel.tsx
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Phone as PhoneIcon, Megaphone, Plus, AlertTriangle } from 'lucide-react'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable } from '@/components/ui/data-table'
import { StepIndicator } from '@/components/callout/StepIndicator'
import { CALLOUT_STEPS, getNextStep as getNextCalloutStep, getPrevStep as getPrevCalloutStep } from '@/components/callout/calloutSteps'
import { useCalloutColumns } from '@/components/callout/CalloutListTable'
import MandatoryOTDialog from '@/components/coverage/MandatoryOTDialog'
import DayOffMandatoryDialog from '@/components/coverage/DayOffMandatoryDialog'
import SmsAlertDialog from '@/components/coverage/SmsAlertDialog'
import {
  useBlockAvailable,
  useCalloutList,
  useCalloutVolunteers,
  useCoverageGaps,
  useClassifications,
  useCreateCalloutEvent,
  useRecordAttempt,
  useAdvanceCalloutStep,
  useCreateOtRequest,
} from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { extractApiError } from '@/lib/format'
import type { CalloutListEntry } from '@/api/callout'
import type { CalloutStep } from '@/api/ot'
import type { ClassificationGap } from '@/api/coveragePlans'
import type { SelectedBlock } from './types'

type AcceptTarget = { user_id: string; name: string }

export interface ActionPanelProps {
  date: string
  block: SelectedBlock | null
  onClose: () => void
}

export default function ActionPanel({ date, block, onClose }: ActionPanelProps) {
  const { isManager } = usePermissions()

  // Internal UI state
  const [acceptTarget, setAcceptTarget] = useState<AcceptTarget | null>(null)
  const [acceptNotes, setAcceptNotes] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [showSmsDialog, setShowSmsDialog] = useState(false)
  const [mandatoryGap, setMandatoryGap] = useState<ClassificationGap | null>(null)
  const [showDayOffDialog, setShowDayOffDialog] = useState(false)
  const [showCreateOt, setShowCreateOt] = useState(false)
  const [otNotes, setOtNotes] = useState('')

  // Data fetching (use empty strings when block is null to disable queries)
  const { data: blockStaffing } = useBlockAvailable(
    date,
    block?.classificationId ?? '',
    block?.blockStart ?? '',
    block?.blockEnd ?? '',
  )
  const { data: allGaps } = useCoverageGaps(date, { enabled: !!date })
  const { data: classifications } = useClassifications()

  const activeCallout = blockStaffing?.existing_callout ?? null
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
  const shortage = block ? Math.max(0, block.min - block.actual) : 0

  // Classification lookup
  const classificationMap = useMemo(
    () => Object.fromEntries((classifications ?? []).map((c) => [c.id, c])),
    [classifications],
  )
  const classInfo = block ? classificationMap[block.classificationId] : null

  // Filtered callout list
  const filteredCalloutList = useMemo(() => {
    if (!calloutList || !debouncedSearch) return calloutList ?? []
    const q = debouncedSearch.toLowerCase()
    return calloutList.filter((r) =>
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
      `${r.last_name}, ${r.first_name}`.toLowerCase().includes(q)
    )
  }, [calloutList, debouncedSearch])

  const employees = blockStaffing?.employees ?? []

  const formattedDate = date ? format(parseISO(date), 'EEE, MMM d, yyyy') : ''

  // Build a fake ClassificationGap for MandatoryOTDialog
  const mandatoryGapForBlock: ClassificationGap | null = block ? {
    classification_id: block.classificationId,
    classification_abbreviation: block.classificationAbbr,
    shift_template_id: '',
    shift_name: `${block.blockStart}-${block.blockEnd}`,
    shift_color: '#dc2626',
    target: block.min,
    actual: block.actual,
    shortage,
  } : null

  // Callout columns
  const calloutColumns = useCalloutColumns({
    isManager,
    eventIsOpen: calloutIsOpen,
    recordMut,
    onAccept: (r: CalloutListEntry) =>
      setAcceptTarget({ user_id: r.user_id, name: `${r.last_name}, ${r.first_name}` }),
    onDecline: (userId: string) => handleRecordResponse(userId, 'declined'),
    onNoAnswer: (userId: string) => handleRecordResponse(userId, 'no_answer'),
  })

  // --- Handlers ---

  function handleStartCallout() {
    if (!blockStaffing?.scheduled_shift_id || !block) return
    createCalloutMut.mutate(
      {
        scheduled_shift_id: blockStaffing.scheduled_shift_id,
        classification_id: block.classificationId,
      },
      {
        onSuccess: () => toast.success('Callout started'),
        onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to start callout')),
      },
    )
  }

  function handleSetStep(step: CalloutStep) {
    if (!activeCalloutId) return
    advanceStepMut.mutate(
      { eventId: activeCalloutId, step },
      {
        onSuccess: () => toast.success(`Moved to ${CALLOUT_STEPS.find((s) => s.key === step)?.label}`),
        onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to change step')),
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
    if (!block || !blockStaffing) return
    createOtMut.mutate(
      {
        date,
        start_time: block.blockStart,
        end_time: block.blockEnd,
        classification_id: block.classificationId,
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

  function handleOpenChange(open: boolean) {
    if (!open) {
      // Reset all dialog state on close
      setAcceptTarget(null)
      setAcceptNotes('')
      setSearch('')
      setShowSmsDialog(false)
      setMandatoryGap(null)
      setShowDayOffDialog(false)
      setShowCreateOt(false)
      setOtNotes('')
      onClose()
    }
  }

  return (
    <>
      <Sheet open={!!block} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {block?.classificationAbbr} &mdash; {block?.blockStart}&ndash;{block?.blockEnd}
            </SheetTitle>
            <SheetDescription>
              {shortage > 0
                ? `Need ${shortage} more (${block?.actual}/${block?.min} staffed)`
                : `At minimum (${block?.actual}/${block?.min} staffed)`}
            </SheetDescription>
          </SheetHeader>

          <div className="p-4 space-y-4">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {!activeCallout && blockStaffing && (
                <Button size="sm" onClick={handleStartCallout} disabled={createCalloutMut.isPending}>
                  <PhoneIcon className="h-4 w-4 mr-1" />
                  {createCalloutMut.isPending ? 'Starting...' : 'Start Callout'}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowCreateOt(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create OT Request
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowSmsDialog(true)}>
                <Megaphone className="h-4 w-4 mr-1" />
                Send SMS
              </Button>
              {mandatoryGapForBlock && shortage > 0 && (
                <Button size="sm" variant="outline" onClick={() => setMandatoryGap(mandatoryGapForBlock)}>
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Mandate On-Shift
                </Button>
              )}
              {block && (
                <Button size="sm" variant="outline" onClick={() => setShowDayOffDialog(true)}>
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Mandate Day Off
                </Button>
              )}
            </div>

            {/* Active Callout */}
            {activeCallout && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      Active Callout
                      <StatusBadge status={activeCallout.status} />
                    </CardTitle>
                    <Link to="/callout" className="text-xs text-primary hover:underline">
                      View Full
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {calloutIsOpen && (
                    <>
                      <StepIndicator currentStep={currentStep} />
                      <div className="flex items-center gap-2 mb-3">
                        {isManager && getPrevCalloutStep(currentStep) && (
                          <Button size="sm" variant="outline" onClick={() => handleSetStep(getPrevCalloutStep(currentStep)!)} disabled={advanceStepMut.isPending}>
                            Back to: {CALLOUT_STEPS.find((s) => s.key === getPrevCalloutStep(currentStep))?.label}
                          </Button>
                        )}
                        {isManager && getNextCalloutStep(currentStep) && (
                          <Button size="sm" variant="outline" onClick={() => handleSetStep(getNextCalloutStep(currentStep)!)} disabled={advanceStepMut.isPending}>
                            Advance to: {CALLOUT_STEPS.find((s) => s.key === getNextCalloutStep(currentStep))?.label}
                          </Button>
                        )}
                      </div>
                      {volunteers && volunteers.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-xs font-medium text-muted-foreground mb-1">
                            Volunteers ({volunteers.length})
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {volunteers.map((v) => (
                              <Badge key={v.id} variant="secondary" className="text-xs">
                                {v.last_name}, {v.first_name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <SearchInput value={search} onChange={setSearch} placeholder="Search..." className="w-full mb-2" />
                      <DataTable
                        columns={calloutColumns}
                        data={filteredCalloutList}
                        rowKey={(r) => r.user_id}
                        emptyMessage="No entries in callout list"
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* OT Requests */}
            {(blockStaffing?.existing_ot_requests ?? []).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Open OT Requests</h4>
                <div className="space-y-1">
                  {blockStaffing!.existing_ot_requests.map((req) => (
                    <Link
                      key={req.id}
                      to={`/ot-requests/${req.id}`}
                      className="flex items-center justify-between border rounded-md p-2 hover:bg-accent/50 transition-colors text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge status={req.status} />
                        <span>{req.start_time}&ndash;{req.end_time}</span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {req.volunteer_count} vol, {req.assignment_count} asgn
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Available Employees */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                Available Employees ({employees.filter((e) => e.is_available).length}/{employees.length})
              </h4>
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No employees in OT queue.</p>
              ) : (
                <DataTable
                  columns={[
                    { header: '#', cell: (r) => <span className="font-semibold tabular-nums text-xs">{r.position}</span> },
                    {
                      header: 'Name',
                      cell: (r) => (
                        <span className={cn('text-sm', !r.is_available && 'text-muted-foreground')}>
                          {r.last_name}, {r.first_name}
                          {r.is_cross_class && (
                            <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 text-amber-700 border-amber-300">xc</Badge>
                          )}
                        </span>
                      ),
                    },
                    { header: 'OT', cell: (r) => <span className="tabular-nums text-xs">{r.ot_hours.toFixed(1)}</span> },
                    {
                      header: 'Phone',
                      cell: (r) =>
                        r.phone ? (
                          <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                            <PhoneIcon className="h-3 w-3" />
                            {r.phone}
                          </a>
                        ) : <span className="text-muted-foreground">&mdash;</span>,
                    },
                    {
                      header: '',
                      cell: (r) =>
                        r.is_available ? (
                          <span className="text-green-600 text-xs">Avail</span>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-muted-foreground text-xs">Busy</span>
                            </TooltipTrigger>
                            <TooltipContent>{r.unavailable_reason}</TooltipContent>
                          </Tooltip>
                        ),
                    },
                  ]}
                  data={employees}
                  rowKey={(r) => r.user_id}
                  emptyMessage="No employees"
                />
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Accept confirmation dialog */}
      <Dialog open={!!acceptTarget} onOpenChange={(open) => !open && setAcceptTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Acceptance</DialogTitle>
            <DialogDescription>
              <strong>{acceptTarget?.name}</strong> has accepted the OT shift.
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
            <DialogDescription>Post an OT request for employees to volunteer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Date:</span>{' '}
                <span className="font-medium">{formattedDate}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time:</span>{' '}
                <span className="font-medium">{block?.blockStart}&ndash;{block?.blockEnd}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Classification:</span>{' '}
                <span className="font-medium">{classInfo?.abbreviation ?? block?.classificationAbbr}</span>
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

      {/* Mandatory OT dialog */}
      {mandatoryGap && (
        <MandatoryOTDialog
          gap={mandatoryGap}
          date={date}
          open={!!mandatoryGap}
          onOpenChange={(open) => !open && setMandatoryGap(null)}
        />
      )}

      {/* Day-off mandatory OT dialog */}
      {blockStaffing && block && (
        <DayOffMandatoryDialog
          date={date}
          defaultStartTime={block.blockStart}
          classificationId={block.classificationId}
          classificationAbbreviation={block.classificationAbbr}
          employees={employees.filter((e) => e.is_available)}
          open={showDayOffDialog}
          onOpenChange={setShowDayOffDialog}
        />
      )}
    </>
  )
}
