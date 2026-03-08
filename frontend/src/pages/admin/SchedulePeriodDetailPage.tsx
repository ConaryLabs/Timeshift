// frontend/src/pages/admin/SchedulePeriodDetailPage.tsx
import { useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Play, Users, Zap, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FormField } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { Badge } from '@/components/ui/badge'
import {
  useSchedulePeriods,
  useSlotAssignments,
  useAssignSlot,
  useRemoveSlotAssignment,
  useUsers,
  useBidWindows,
  useOpenBidding,
  useProcessBids,
  useApproveBidWindow,
} from '@/hooks/queries'
import { formatTime, NO_VALUE, extractApiError, formatDateFull, formatDateTime, DAY_LABELS } from '@/lib/format'
import type { SlotAssignmentView } from '@/api/schedulePeriods'
import type { BidWindow } from '@/api/bidding'
import type { BidPeriodStatus } from '@/api/bidding'

function StatusBadge({ status }: { status: BidPeriodStatus }) {
  const config: Record<BidPeriodStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    open: { label: 'Bidding Open', variant: 'default', className: 'bg-green-600 hover:bg-green-700' },
    in_progress: { label: 'Processing', variant: 'default', className: 'bg-amber-600 hover:bg-amber-700' },
    completed: { label: 'Completed', variant: 'default', className: 'bg-blue-600 hover:bg-blue-700' },
    archived: { label: 'Archived', variant: 'outline' },
  }
  const c = config[status]
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>
}

function getWindowStatus(w: BidWindow) {
  if (!w.unlocked_at) return 'locked' as const
  if (w.submitted_at && w.approved_at) return 'approved' as const
  if (w.submitted_at) return 'submitted' as const
  const now = new Date()
  const opens = new Date(w.opens_at)
  const closes = new Date(w.closes_at)
  if (now < opens) return 'upcoming' as const
  if (now > closes) return 'closed' as const
  return 'active' as const
}

export default function SchedulePeriodDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [assignTarget, setAssignTarget] = useState<SlotAssignmentView | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>(NO_VALUE)
  const [removeTarget, setRemoveTarget] = useState<SlotAssignmentView | null>(null)
  const [openBidDialog, setOpenBidDialog] = useState(false)
  const [windowDuration, setWindowDuration] = useState('24')
  const [confirmProcess, setConfirmProcess] = useState(false)

  const periodId = id ?? ''

  const { data: periods, isLoading: periodsLoading } = useSchedulePeriods()
  const { data: assignments, isLoading: assignmentsLoading, isError } = useSlotAssignments(periodId)
  const { data: users } = useUsers()
  const { data: bidWindows, isLoading: windowsLoading } = useBidWindows(periodId)
  const assignMut = useAssignSlot()
  const removeMut = useRemoveSlotAssignment()
  const openBiddingMut = useOpenBidding()
  const processBidsMut = useProcessBids()
  const approveMut = useApproveBidWindow()

  if (!id) return <Navigate to="/admin/schedule-periods" replace />

  const period = periods?.find((p) => p.id === periodId)
  const activeUsers = (users ?? []).filter((u) => u.is_active)

  function openAssign(row: SlotAssignmentView) {
    setAssignTarget(row)
    setSelectedUserId(row.user_id ?? NO_VALUE)
  }

  function handleAssign() {
    if (!assignTarget || selectedUserId === NO_VALUE) return
    assignMut.mutate(
      { periodId, slot_id: assignTarget.slot_id, user_id: selectedUserId },
      {
        onSuccess: () => {
          toast.success('Assignment saved')
          setAssignTarget(null)
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to save slot assignment')
          toast.error(msg)
        },
      },
    )
  }

  function handleRemove() {
    if (!removeTarget) return
    removeMut.mutate(
      { periodId, slotId: removeTarget.slot_id },
      {
        onSuccess: () => {
          toast.success('Assignment removed')
          setRemoveTarget(null)
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to remove slot assignment')
          toast.error(msg)
        },
      },
    )
  }

  function handleOpenBidding() {
    const hours = parseInt(windowDuration, 10)
    if (!hours || hours < 1) {
      toast.error('Window duration must be at least 1 hour')
      return
    }
    openBiddingMut.mutate(
      { periodId, window_duration_hours: hours },
      {
        onSuccess: () => {
          toast.success('Bidding opened successfully')
          setOpenBidDialog(false)
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to open bidding')
          toast.error(msg)
        },
      },
    )
  }

  function handleProcessBids() {
    processBidsMut.mutate(periodId, {
      onSuccess: (data: { awards_count: number; total_bidders: number }) => {
        toast.success(`Bids processed: ${data.awards_count} of ${data.total_bidders} users awarded slots`)
        setConfirmProcess(false)
      },
      onError: (err: unknown) => {
        const msg = extractApiError(err, 'Failed to process bids')
        toast.error(msg)
      },
    })
  }

  function handleApproveWindow(windowId: string) {
    approveMut.mutate(windowId, {
      onSuccess: () => {
        toast.success('Bid window approved — next window unlocked')
      },
      onError: (err: unknown) => {
        const msg = extractApiError(err, 'Failed to approve bid window')
        toast.error(msg)
      },
    })
  }

  const columns: Column<SlotAssignmentView>[] = [
    { header: 'Team', accessorKey: 'team_name' },
    { header: 'Shift', accessorKey: 'shift_template_name' },
    {
      header: 'Time',
      cell: (r) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}`,
    },
    {
      header: 'Classification',
      cell: (r) => (
        <Badge variant="outline" className="text-xs font-mono">{r.classification_abbreviation}</Badge>
      ),
    },
    {
      header: 'Days',
      cell: (r) => (
        <div className="flex gap-0.5">
          {r.days_of_week.map((d) => (
            <span
              key={d}
              className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium w-7 h-5"
            >
              {DAY_LABELS[d]}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: 'Assigned To',
      cell: (r) =>
        r.user_id ? (
          <span className="font-medium">{r.user_last_name}, {r.user_first_name}</span>
        ) : (
          <span className="text-muted-foreground italic">Unassigned</span>
        ),
    },
    {
      header: 'Actions',
      cell: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => openAssign(r)}>
            {r.user_id ? 'Change' : 'Assign'}
          </Button>
          {r.user_id && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-700 hover:bg-red-50"
              onClick={() => setRemoveTarget(r)}
            >
              Remove
            </Button>
          )}
        </div>
      ),
    },
  ]

  // Bid window columns
  const pendingApproval = (bidWindows ?? []).filter(
    (w) => w.submitted_at && !w.approved_at,
  )

  const windowColumns: Column<BidWindow>[] = [
    {
      header: 'Rank',
      cell: (r) => <span className="font-mono font-bold">#{r.seniority_rank}</span>,
    },
    {
      header: 'Employee',
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          {r.last_name}, {r.first_name}
          {r.is_job_share && (
            <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 py-0 h-5">Job Share</Badge>
          )}
        </span>
      ),
    },
    {
      header: 'Opens',
      cell: (r) => formatDateTime(r.opens_at),
    },
    {
      header: 'Closes',
      cell: (r) => formatDateTime(r.closes_at),
    },
    {
      header: 'Status',
      cell: (r) => {
        const s = getWindowStatus(r)
        if (s === 'approved') return <Badge className="bg-green-700">Approved</Badge>
        if (s === 'submitted') return <Badge className="bg-blue-600">Submitted</Badge>
        if (s === 'active') return <Badge className="bg-green-600">Active</Badge>
        if (s === 'closed') return <Badge variant="outline">Closed</Badge>
        if (s === 'locked') return <Badge variant="secondary">Locked</Badge>
        return <Badge variant="secondary">Upcoming</Badge>
      },
    },
    {
      header: 'Actions',
      cell: (r) => {
        if (r.submitted_at && !r.approved_at) {
          return (
            <Button
              size="sm"
              variant="outline"
              className="text-green-700 hover:bg-green-50"
              onClick={() => handleApproveWindow(r.id)}
              disabled={approveMut.isPending}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              Approve
            </Button>
          )
        }
        return null
      },
    },
  ]

  if (periodsLoading) return <LoadingState />

  const status = period?.status ?? 'draft'
  const allWindowsClosed = bidWindows?.every((w) => {
    const closes = new Date(w.closes_at)
    return w.submitted_at || closes < new Date()
  })

  return (
    <div>
      <Link
        to="/admin/schedule-periods"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Schedule Periods
      </Link>

      <PageHeader
        title={period?.name ?? 'Schedule Period'}
        description={
          period
            ? `${formatDateFull(period.start_date)} – ${formatDateFull(period.end_date)}`
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {status === 'draft' && (
              <Button onClick={() => setOpenBidDialog(true)}>
                <Play className="w-4 h-4 mr-2" />
                Open Bidding
              </Button>
            )}
            {status === 'open' && allWindowsClosed && (
              <Button onClick={() => setConfirmProcess(true)}>
                <Zap className="w-4 h-4 mr-2" />
                Process Bids
              </Button>
            )}
          </div>
        }
      />

      {/* Pending Approval banner */}
      {status === 'open' && pendingApproval.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-amber-800">
                <strong>{pendingApproval.length}</strong> bid{pendingApproval.length > 1 ? 's' : ''} awaiting supervisor approval.
                The next employee's window will unlock once approved.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bid Windows section (when bidding has been opened) */}
      {(status === 'open' || status === 'completed' || status === 'in_progress') && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Bid Windows
            </CardTitle>
            <CardDescription>
              {status === 'open' && period?.bid_opens_at && period?.bid_closes_at && (
                <>
                  Bidding: {formatDateTime(period.bid_opens_at)} – {formatDateTime(period.bid_closes_at)}
                </>
              )}
              {status === 'completed' && 'Bidding complete. Slots have been awarded.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={windowColumns}
              data={bidWindows ?? []}
              isLoading={windowsLoading}
              emptyMessage="No bid windows found."
              rowKey={(r) => r.id}
            />
          </CardContent>
        </Card>
      )}

      {/* Slot Assignments table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Slot Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <ErrorState message="Failed to load slot assignments." />
          ) : (
            <DataTable
              columns={columns}
              data={assignments ?? []}
              isLoading={assignmentsLoading}
              emptyMessage="No active shift slots found. Create teams and shift slots first."
              rowKey={(r) => r.slot_id}
            />
          )}
        </CardContent>
      </Card>

      {/* Open Bidding dialog */}
      <Dialog open={openBidDialog} onOpenChange={setOpenBidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Shift Bidding</DialogTitle>
            <DialogDescription>
              Each employee will get a bidding window in seniority order. Set how long each window lasts.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Window Duration (hours)" htmlFor="window-duration" required>
            <Input
              id="window-duration"
              type="number"
              min={1}
              value={windowDuration}
              onChange={(e) => setWindowDuration(e.target.value)}
              placeholder="24"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {(() => {
                const eligible = period?.bargaining_unit
                  ? activeUsers.filter((u) => u.bargaining_unit === period.bargaining_unit)
                  : activeUsers
                return `${eligible.length} eligible users${period?.bargaining_unit ? ` (${period.bargaining_unit})` : ''}. Total bidding time: ~${parseInt(windowDuration, 10) * eligible.length || 0} hours.`
              })()}
            </p>
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBidDialog(false)}>Cancel</Button>
            <Button onClick={handleOpenBidding} disabled={openBiddingMut.isPending}>
              <Play className="w-4 h-4 mr-2" />
              Open Bidding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Bids confirmation dialog */}
      <Dialog open={confirmProcess} onOpenChange={setConfirmProcess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process All Bids</DialogTitle>
            <DialogDescription>
              This will award slots to employees based on their ranked preferences and seniority order.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmProcess(false)}>Cancel</Button>
            <Button onClick={handleProcessBids} disabled={processBidsMut.isPending}>
              <Zap className="w-4 h-4 mr-2" />
              Process Bids
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign / reassign dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignTarget?.user_id ? 'Change Assignment' : 'Assign Slot'}
            </DialogTitle>
            {assignTarget && (
              <DialogDescription>
                {assignTarget.shift_template_name} · {formatTime(assignTarget.start_time)} – {formatTime(assignTarget.end_time)} · {assignTarget.classification_abbreviation}
              </DialogDescription>
            )}
          </DialogHeader>
          <FormField label="Select User" htmlFor="assign-user" required>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="assign-user">
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {activeUsers.map((u) => {
                  const matches = u.classification_id === assignTarget?.classification_id
                  return (
                    <SelectItem key={u.id} value={u.id}>
                      <span className={matches ? undefined : 'text-muted-foreground'}>
                        {u.last_name}, {u.first_name}
                        {!matches && (
                          <span className="ml-1 text-xs">
                            ({u.classification_name ?? 'no classification'})
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {selectedUserId !== '__none__' && (() => {
              const selectedUser = activeUsers.find((u) => u.id === selectedUserId)
              if (selectedUser && selectedUser.classification_id !== assignTarget?.classification_id) {
                return (
                  <p className="text-xs text-amber-600 mt-1">
                    Warning: this user's classification ({selectedUser.classification_name ?? 'none'}) does not match the slot's required classification ({assignTarget?.classification_name}).
                  </p>
                )
              }
              return null
            })()}
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancel</Button>
            <Button
              onClick={handleAssign}
              disabled={selectedUserId === NO_VALUE || assignMut.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation dialog */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Assignment</DialogTitle>
            <DialogDescription>
              Remove{' '}
              <strong>{removeTarget?.user_last_name}, {removeTarget?.user_first_name}</strong>{' '}
              from{' '}
              <strong>{removeTarget?.shift_template_name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removeMut.isPending}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
