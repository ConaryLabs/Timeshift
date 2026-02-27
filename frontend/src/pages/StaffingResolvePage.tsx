import { useState, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { format, addDays, parseISO } from 'date-fns'
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Phone as PhoneIcon, Megaphone, Plus, AlertTriangle, Users } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  useDayGrid,
  useBlockAvailable,
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
import type { ClassificationGap, ClassificationBlock } from '@/api/coveragePlans'

type BlockSize = '30min' | '1h' | '2h'

type SelectedBlock = {
  classificationId: string
  classificationAbbr: string
  blockStart: string
  blockEnd: string
  target: number
  actual: number
}

type AcceptTarget = { user_id: string; name: string }

export default function StaffingResolvePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isManager } = usePermissions()

  // URL params — date-centric
  const dateParam = searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd')
  const date = dateParam

  // UI state
  const [blockSize, setBlockSize] = useState<BlockSize>('2h')
  const [selectedBlock, setSelectedBlock] = useState<SelectedBlock | null>(null)
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
  const { data: dayGrid, isLoading, isError } = useDayGrid(date)
  const { data: allGaps } = useCoverageGaps(date, { enabled: !!date })
  const { data: classifications } = useClassifications()

  // Block available data for the selected block
  const { data: blockStaffing } = useBlockAvailable(
    date,
    selectedBlock?.classificationId ?? '',
    selectedBlock?.blockStart ?? '',
    selectedBlock?.blockEnd ?? '',
  )

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

  // Classification lookup
  const classificationMap = useMemo(
    () => Object.fromEntries((classifications ?? []).map((c) => [c.id, c])),
    [classifications],
  )

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

  // Block columns based on block size
  const blockColumns = useMemo(() => {
    const count = blockSize === '30min' ? 48 : blockSize === '1h' ? 24 : 12
    const minutesPerBlock = blockSize === '30min' ? 30 : blockSize === '1h' ? 60 : 120
    return Array.from({ length: count }, (_, i) => {
      const startMin = i * minutesPerBlock
      const endMin = startMin + minutesPerBlock
      const startH = Math.floor(startMin / 60)
      const startM = startMin % 60
      const endH = Math.floor(endMin / 60) % 24
      const endM = endMin % 60
      return {
        index: i,
        startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
        endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
        label: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      }
    })
  }, [blockSize])

  // Re-aggregate dayGrid data according to selected block size
  const aggregatedClassifications = useMemo(() => {
    if (!dayGrid) return []
    if (blockSize === '2h') {
      // Native 2h blocks from the API
      return dayGrid.classifications
    }
    // Re-aggregate: each API block is 2h (4 half-hour slots).
    // For 1h: split each 2h block into two 1h blocks
    // For 30min: split into four 30min blocks
    // We can derive from the native block data approximately
    return dayGrid.classifications.map((cls) => {
      if (blockSize === '1h') {
        // Split each 2h block into 2 1h blocks (approximate: same values)
        const newBlocks: ClassificationBlock[] = []
        for (const b of cls.blocks) {
          const startH = parseInt(b.start_time)
          for (let sub = 0; sub < 2; sub++) {
            const h = startH + sub
            newBlocks.push({
              ...b,
              block_index: newBlocks.length,
              start_time: `${String(h).padStart(2, '0')}:00`,
              end_time: `${String(h + 1).padStart(2, '0')}:00`,
            })
          }
        }
        return { ...cls, blocks: newBlocks }
      }
      // 30min: split each 2h block into 4
      const newBlocks: ClassificationBlock[] = []
      for (const b of cls.blocks) {
        const startH = parseInt(b.start_time)
        for (let sub = 0; sub < 4; sub++) {
          const totalMin = startH * 60 + sub * 30
          const h = Math.floor(totalMin / 60)
          const m = totalMin % 60
          const endMin = totalMin + 30
          const eh = Math.floor(endMin / 60)
          const em = endMin % 60
          newBlocks.push({
            ...b,
            block_index: newBlocks.length,
            start_time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
            end_time: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
          })
        }
      }
      return { ...cls, blocks: newBlocks }
    })
  }, [dayGrid, blockSize])

  // --- Handlers ---

  function navigateDate(offset: number) {
    const newDate = addDays(parseISO(date), offset)
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') })
  }

  function goToday() {
    setSearchParams({ date: format(new Date(), 'yyyy-MM-dd') })
  }

  function handleBlockClick(classificationId: string, classificationAbbr: string, block: ClassificationBlock) {
    if (block.status === 'green' && block.actual >= block.target) return
    setSelectedBlock({
      classificationId,
      classificationAbbr,
      blockStart: block.start_time,
      blockEnd: block.end_time,
      target: block.target,
      actual: block.actual,
    })
  }

  function getNextStep(): CalloutStep | null {
    if (!currentStep) return 'volunteers'
    const idx = CALLOUT_STEPS.findIndex((s) => s.key === currentStep)
    if (idx < CALLOUT_STEPS.length - 1) return CALLOUT_STEPS[idx + 1].key
    return null
  }

  function handleStartCallout() {
    if (!blockStaffing?.scheduled_shift_id || !selectedBlock) return
    createCalloutMut.mutate(
      {
        scheduled_shift_id: blockStaffing.scheduled_shift_id,
        classification_id: selectedBlock.classificationId,
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
    if (!selectedBlock || !blockStaffing) return
    createOtMut.mutate(
      {
        date,
        start_time: selectedBlock.blockStart,
        end_time: selectedBlock.blockEnd,
        classification_id: selectedBlock.classificationId,
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

  const formattedDate = date ? format(parseISO(date), 'EEE, MMM d, yyyy') : ''
  const classInfo = selectedBlock ? classificationMap[selectedBlock.classificationId] : null
  const shortage = selectedBlock ? Math.max(0, selectedBlock.target - selectedBlock.actual) : 0

  // Build a fake ClassificationGap for MandatoryOTDialog
  const mandatoryGapForBlock: ClassificationGap | null = selectedBlock ? {
    classification_id: selectedBlock.classificationId,
    classification_abbreviation: selectedBlock.classificationAbbr,
    shift_template_id: '', // not used by MandatoryOTDialog for the block flow
    shift_name: `${selectedBlock.blockStart}-${selectedBlock.blockEnd}`,
    shift_color: '#dc2626',
    target: selectedBlock.target,
    actual: selectedBlock.actual as unknown as number,
    shortage,
  } : null

  if (!date) {
    return (
      <div>
        <PageHeader title="Coverage Day View" />
        <EmptyState
          title="Missing date"
          description="Navigate here from the schedule view."
        />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Coverage Day View"
        description={formattedDate}
        actions={
          <div className="flex items-center gap-2">
            <Select value={blockSize} onValueChange={(v) => setBlockSize(v as BlockSize)}>
              <SelectTrigger className="w-[100px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30min">30 min</SelectItem>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="2h">2 hours</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => navigateDate(-1)} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => navigateDate(1)} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      {isLoading && <LoadingState />}
      {isError && (
        <EmptyState
          title="Failed to load coverage data"
          description="Try refreshing the page or go back to the schedule."
        />
      )}

      {dayGrid && (
        <div className="space-y-3">
          {/* Time header row (shared across all classifications) */}
          <div className="flex border rounded-t-lg overflow-hidden bg-muted/30">
            <div className="w-36 shrink-0 border-r" />
            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${blockColumns.length}, 1fr)` }}>
              {blockColumns.map((col) => (
                <div key={col.index} className="text-[11px] font-medium text-muted-foreground text-center border-r last:border-r-0 px-0.5 py-1.5">
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          {aggregatedClassifications.map((cls) => (
            <ClassificationRow
              key={cls.classification_id}
              classificationId={cls.classification_id}
              abbreviation={cls.abbreviation}
              blocks={cls.blocks}
              blockColumns={blockColumns}
              onBlockClick={(block) => handleBlockClick(cls.classification_id, cls.abbreviation, block)}
            />
          ))}

          {/* Total summary row */}
          {dayGrid.blocks.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              {/* Total target */}
              <div className="flex bg-muted/30">
                <div className="w-36 shrink-0 border-r flex items-center px-2">
                  <span className="text-[10px] text-muted-foreground">Total Target</span>
                </div>
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${blockColumns.length}, 1fr)` }}>
                  {blockColumns.map((col) => {
                    const aggBlock = dayGrid.blocks[Math.floor(col.index * (12 / blockColumns.length))]
                    return (
                      <div key={col.index} className="border-r last:border-r-0 h-5 flex items-center justify-center text-[10px] tabular-nums text-muted-foreground">
                        {aggBlock?.total_target ?? ''}
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Total actual */}
              <div className="flex bg-muted/30">
                <div className="w-36 shrink-0 border-r flex items-center px-2">
                  <span className="text-[10px] font-bold">Total Actual</span>
                </div>
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${blockColumns.length}, 1fr)` }}>
                  {blockColumns.map((col) => {
                    const aggBlock = dayGrid.blocks[Math.floor(col.index * (12 / blockColumns.length))]
                    if (!aggBlock) return <div key={col.index} className="border-r last:border-r-0 h-6" />
                    return (
                      <div
                        key={col.index}
                        className={cn(
                          'border-r last:border-r-0 h-6 flex items-center justify-center text-xs tabular-nums font-bold',
                          aggBlock.status === 'green' && 'text-green-800 dark:text-green-400',
                          aggBlock.status === 'yellow' && 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
                          aggBlock.status === 'red' && 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
                        )}
                      >
                        {aggBlock.total_actual}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {aggregatedClassifications.length === 0 && (
            <EmptyState
              title="No coverage plan configured"
              description="Set up coverage plans in the admin panel to see coverage data."
            />
          )}
        </div>
      )}

      {/* Slide-out panel for resolving a shortage block */}
      <Sheet open={!!selectedBlock} onOpenChange={(open) => !open && setSelectedBlock(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedBlock?.classificationAbbr} &mdash; {selectedBlock?.blockStart}&ndash;{selectedBlock?.blockEnd}
            </SheetTitle>
            <SheetDescription>
              {shortage > 0
                ? `Need ${shortage} more (${selectedBlock?.actual}/${selectedBlock?.target} staffed)`
                : `Below target (${selectedBlock?.actual}/${selectedBlock?.target} staffed)`}
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
              {selectedBlock && (
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
                        {isManager && getNextStep() && (
                          <Button size="sm" variant="outline" onClick={handleAdvanceStep} disabled={advanceStepMut.isPending}>
                            Advance to: {CALLOUT_STEPS.find((s) => s.key === getNextStep())?.label}
                          </Button>
                        )}
                      </div>
                      {(volunteers ?? []).length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-xs font-medium text-muted-foreground mb-1">
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
                <span className="font-medium">{selectedBlock?.blockStart}&ndash;{selectedBlock?.blockEnd}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Classification:</span>{' '}
                <span className="font-medium">{classInfo?.abbreviation ?? selectedBlock?.classificationAbbr}</span>
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
      {blockStaffing && selectedBlock && (
        <DayOffMandatoryDialog
          date={date}
          defaultStartTime={selectedBlock.blockStart}
          classificationId={selectedBlock.classificationId}
          classificationAbbreviation={selectedBlock.classificationAbbr}
          employees={employees.filter((e) => e.is_available)}
          open={showDayOffDialog}
          onOpenChange={setShowDayOffDialog}
        />
      )}
    </div>
  )
}

// ── Classification Row: Employee Gantt + Coverage Summary ──────────────────

function ClassificationRow({
  abbreviation,
  blocks,
  blockColumns,
  onBlockClick,
}: {
  classificationId: string
  abbreviation: string
  blocks: ClassificationBlock[]
  blockColumns: { index: number; startTime: string; endTime: string; label: string }[]
  onBlockClick: (block: ClassificationBlock) => void
}) {
  const [expanded, setExpanded] = useState(true)

  // Collect unique assignments across all blocks (keyed by assignment_id so
  // an employee with two assignments — e.g. overnight carryover + today's shift — gets two bars)
  const uniqueAssignments = useMemo(() => {
    const seen = new Map<string, { assignmentId: string; userId: string; firstName: string; lastName: string; shiftName: string; shiftStart: string; shiftEnd: string; isOvertime: boolean }>()
    for (const b of blocks) {
      for (const e of b.employees) {
        if (!seen.has(e.assignment_id)) {
          seen.set(e.assignment_id, {
            assignmentId: e.assignment_id,
            userId: e.user_id,
            firstName: e.first_name,
            lastName: e.last_name,
            shiftName: e.shift_name,
            shiftStart: e.shift_start,
            shiftEnd: e.shift_end,
            isOvertime: e.is_overtime,
          })
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.shiftStart.localeCompare(b.shiftStart) || a.lastName.localeCompare(b.lastName),
    )
  }, [blocks])

  const totalCols = blockColumns.length
  const hasShortage = blocks.some((b) => b.status === 'red' || b.status === 'yellow')

  // Calculate bar position (left% and width%)
  function barPosition(shiftStart: string, shiftEnd: string) {
    const [sh, sm] = shiftStart.split(':').map(Number)
    const [eh, em] = shiftEnd.split(':').map(Number)
    const startMin = sh * 60 + sm
    let endMin = eh * 60 + em
    if (endMin <= startMin) endMin = 24 * 60 // crosses midnight
    const totalMin = 24 * 60
    const left = (startMin / totalMin) * 100
    const width = ((endMin - startMin) / totalMin) * 100
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }
  }

  function getBlock(colIndex: number): ClassificationBlock | undefined {
    return blocks[colIndex]
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', hasShortage && 'border-amber-300/60')}>
      {/* Classification header (collapsible) */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors border-b"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span className="font-semibold text-sm">{abbreviation}</span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" />
          {new Set(uniqueAssignments.map(a => a.userId)).size} {new Set(uniqueAssignments.map(a => a.userId)).size === 1 ? 'person' : 'people'}
        </span>
        {hasShortage && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
            Shortage
          </Badge>
        )}
      </button>

      {expanded && (
        <>
          {/* Employee Gantt rows */}
          {uniqueAssignments.length > 0 ? (
            <div className="bg-card">
              {uniqueAssignments.map((emp, idx) => {
                const pos = barPosition(emp.shiftStart, emp.shiftEnd)
                return (
                  <div
                    key={emp.assignmentId}
                    className={cn('flex items-center', idx !== uniqueAssignments.length - 1 && 'border-b border-dashed border-border/50')}
                  >
                    {/* Name column */}
                    <div className="w-36 shrink-0 border-r px-2 py-1 flex items-center gap-1 min-h-[28px]">
                      <span className="text-xs truncate">
                        {emp.lastName}, {emp.firstName[0]}.
                      </span>
                      {emp.isOvertime && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0 text-amber-700 border-amber-400 bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-900/30">
                          OT
                        </Badge>
                      )}
                    </div>
                    {/* Gantt bar area */}
                    <div className="flex-1 relative h-7">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'absolute top-1 h-5 rounded text-[10px] font-medium flex items-center px-1.5 truncate shadow-sm',
                              emp.isOvertime
                                ? 'bg-amber-300/80 text-amber-950 dark:bg-amber-700/70 dark:text-amber-50'
                                : 'bg-indigo-300/70 text-indigo-950 dark:bg-indigo-700/60 dark:text-indigo-50',
                            )}
                            style={{ left: pos.left, width: pos.width }}
                          >
                            <span className="truncate">
                              {emp.shiftName}
                              {emp.isOvertime && ' OT'}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <div className="text-xs">
                            <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                            <div>{emp.shiftName} ({emp.shiftStart}&ndash;{emp.shiftEnd})</div>
                            {emp.isOvertime && <div className="text-amber-600 font-medium">Overtime</div>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-muted-foreground italic bg-card">
              No employees assigned
            </div>
          )}

          {/* Coverage summary rows: Target, Actual, Min (matching SE layout) */}
          <div className="border-t bg-muted/20">
            {/* Target row */}
            <div className="flex">
              <div className="w-36 shrink-0 border-r flex items-center px-2">
                <span className="text-[10px] text-muted-foreground">Target</span>
              </div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}>
                {blockColumns.map((col) => {
                  const block = getBlock(col.index)
                  return (
                    <div key={col.index} className="border-r last:border-r-0 h-5 flex items-center justify-center text-[10px] tabular-nums text-muted-foreground">
                      {block?.target ?? ''}
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Actual row (main — bold, color-coded, clickable) */}
            <div className="flex">
              <div className="w-36 shrink-0 border-r flex items-center px-2">
                <span className="text-[10px] font-semibold text-foreground">Actual</span>
              </div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}>
                {blockColumns.map((col) => {
                  const block = getBlock(col.index)
                  if (!block) return <div key={col.index} className="border-r last:border-r-0 h-6" />
                  const isClickable = block.status !== 'green' || block.actual < block.target
                  return (
                    <button
                      key={col.index}
                      type="button"
                      disabled={!isClickable}
                      onClick={() => isClickable && onBlockClick(block)}
                      className={cn(
                        'border-r last:border-r-0 h-6 flex items-center justify-center text-xs tabular-nums font-bold transition-colors',
                        block.status === 'green' && 'text-green-800 dark:text-green-400',
                        block.status === 'yellow' && 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
                        block.status === 'red' && 'bg-red-100 text-red-800 font-black dark:bg-red-950/30 dark:text-red-400',
                        isClickable && 'cursor-pointer hover:bg-accent/50',
                      )}
                      title={`${abbreviation} ${block.start_time}-${block.end_time}: ${block.actual} staffed (target: ${block.target}, min: ${block.min})`}
                    >
                      {block.actual}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Min row */}
            <div className="flex">
              <div className="w-36 shrink-0 border-r flex items-center px-2">
                <span className="text-[10px] text-muted-foreground">Min</span>
              </div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}>
                {blockColumns.map((col) => {
                  const block = getBlock(col.index)
                  return (
                    <div key={col.index} className="border-r last:border-r-0 h-5 flex items-center justify-center text-[10px] tabular-nums text-muted-foreground">
                      {block?.min ?? ''}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
