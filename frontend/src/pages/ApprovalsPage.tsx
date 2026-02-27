import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import { Checkbox } from '@/components/ui/checkbox'
import {
  useLeaveRequests,
  useTrades,
  useReviewLeave,
  useReviewTrade,
  useBulkReviewLeave,
  useBulkReviewTrade,
  useNavBadges,
} from '@/hooks/queries'
import { cn } from '@/lib/utils'
import { extractApiError } from '@/lib/format'
import type { LeaveRequest } from '@/api/leave'
import type { TradeRequest } from '@/api/trades'

type Tab = 'leave' | 'trades'

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateRange(start: string, end: string) {
  if (start === end) return formatDate(start)
  return `${formatDate(start)} - ${formatDate(end)}`
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function totalHours(req: LeaveRequest): number {
  if (req.lines && req.lines.length > 0) {
    return req.lines.reduce((sum, l) => sum + l.hours, 0)
  }
  return req.hours ?? 0
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>('leave')
  const [selectedLeave, setSelectedLeave] = useState<Set<string>>(new Set())
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [denyTarget, setDenyTarget] = useState<{ id: string; type: Tab } | null>(null)
  const [denyReason, setDenyReason] = useState('')

  const { data: allLeave, isLoading: leaveLoading } = useLeaveRequests()
  const { data: allTrades, isLoading: tradesLoading } = useTrades({ status: 'pending_approval' })
  const { data: navBadges } = useNavBadges()

  const reviewLeave = useReviewLeave()
  const reviewTrade = useReviewTrade()
  const bulkReviewLeave = useBulkReviewLeave()
  const bulkReviewTrade = useBulkReviewTrade()

  const pendingLeave = useMemo(
    () => (allLeave ?? []).filter((r) => r.status === 'pending'),
    [allLeave],
  )
  const pendingTrades = useMemo(() => allTrades ?? [], [allTrades])

  const leaveCount = navBadges?.pending_leave ?? pendingLeave.length
  const tradeCount = navBadges?.pending_trades ?? pendingTrades.length

  const isLoading = tab === 'leave' ? leaveLoading : tradesLoading

  function handleApproveLeave(id: string) {
    reviewLeave.mutate(
      { id, status: 'approved' },
      {
        onSuccess: () => {
          toast.success('Leave request approved')
          setSelectedLeave((s) => { const n = new Set(s); n.delete(id); return n })
        },
        onError: (e) => toast.error(extractApiError(e, 'Something went wrong')),
      },
    )
  }

  function handleApproveTrade(id: string) {
    reviewTrade.mutate(
      { id, status: 'approved' },
      {
        onSuccess: () => {
          toast.success('Trade approved')
          setSelectedTrades((s) => { const n = new Set(s); n.delete(id); return n })
        },
        onError: (e) => toast.error(extractApiError(e, 'Something went wrong')),
      },
    )
  }

  function handleDenyConfirm() {
    if (!denyTarget) return
    if (denyTarget.type === 'leave') {
      reviewLeave.mutate(
        { id: denyTarget.id, status: 'denied', reviewer_notes: denyReason || undefined },
        {
          onSuccess: () => {
            toast.success('Leave request denied')
            setDenyTarget(null)
            setDenyReason('')
            setSelectedLeave((s) => { const n = new Set(s); n.delete(denyTarget.id); return n })
          },
          onError: (e) => toast.error(extractApiError(e, 'Something went wrong')),
        },
      )
    } else {
      reviewTrade.mutate(
        { id: denyTarget.id, status: 'denied', reviewer_notes: denyReason || undefined },
        {
          onSuccess: () => {
            toast.success('Trade denied')
            setDenyTarget(null)
            setDenyReason('')
            setSelectedTrades((s) => { const n = new Set(s); n.delete(denyTarget.id); return n })
          },
          onError: (e) => toast.error(extractApiError(e, 'Something went wrong')),
        },
      )
    }
  }

  function handleBulkApprove() {
    if (tab === 'leave' && selectedLeave.size > 0) {
      bulkReviewLeave.mutate(
        { ids: Array.from(selectedLeave), status: 'approved' },
        {
          onSuccess: (res) => {
            toast.success(`${res.reviewed} leave request${res.reviewed !== 1 ? 's' : ''} approved`)
            setSelectedLeave(new Set())
          },
          onError: (e) => toast.error(extractApiError(e, 'Something went wrong')),
        },
      )
    } else if (tab === 'trades' && selectedTrades.size > 0) {
      bulkReviewTrade.mutate(
        { ids: Array.from(selectedTrades), status: 'approved' },
        {
          onSuccess: (res) => {
            toast.success(`${res.reviewed} trade${res.reviewed !== 1 ? 's' : ''} approved`)
            setSelectedTrades(new Set())
          },
          onError: (e) => toast.error(extractApiError(e, 'Something went wrong')),
        },
      )
    }
  }

  const currentSelected = tab === 'leave' ? selectedLeave : selectedTrades
  const currentItems = tab === 'leave' ? pendingLeave : pendingTrades
  const allSelected = currentItems.length > 0 && currentSelected.size === currentItems.length

  function toggleSelectAll() {
    if (tab === 'leave') {
      setSelectedLeave(allSelected ? new Set() : new Set(pendingLeave.map((r) => r.id)))
    } else {
      setSelectedTrades(allSelected ? new Set() : new Set(pendingTrades.map((r) => r.id)))
    }
  }

  function toggleItem(id: string) {
    if (tab === 'leave') {
      setSelectedLeave((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
    } else {
      setSelectedTrades((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Approvals" description="Pending items requiring your review" />

      {/* Tab buttons */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('leave')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'leave'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          Leave{leaveCount > 0 ? ` (${leaveCount})` : ''}
        </button>
        <button
          onClick={() => setTab('trades')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'trades'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          Trades{tradeCount > 0 ? ` (${tradeCount})` : ''}
        </button>
      </div>

      {isLoading && <LoadingState message="Loading..." />}

      {!isLoading && currentItems.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">
              No pending {tab === 'leave' ? 'leave requests' : 'trades'} to review.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && currentItems.length > 0 && (
        <>
          {/* Bulk actions bar */}
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
              <span className="text-muted-foreground">
                {currentSelected.size > 0
                  ? `${currentSelected.size} selected`
                  : 'Select all'}
              </span>
            </label>
            {currentSelected.size > 0 && (
              <Button
                size="sm"
                onClick={handleBulkApprove}
                disabled={bulkReviewLeave.isPending || bulkReviewTrade.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Approve {currentSelected.size}
              </Button>
            )}
          </div>

          {/* Items list */}
          <div className="space-y-2">
            {tab === 'leave' && pendingLeave.map((req) => (
              <LeaveApprovalCard
                key={req.id}
                request={req}
                selected={selectedLeave.has(req.id)}
                expanded={expandedId === req.id}
                onToggleSelect={() => toggleItem(req.id)}
                onToggleExpand={() => setExpandedId(expandedId === req.id ? null : req.id)}
                onApprove={() => handleApproveLeave(req.id)}
                onDeny={() => { setDenyTarget({ id: req.id, type: 'leave' }); setDenyReason('') }}
                isPending={reviewLeave.isPending}
              />
            ))}
            {tab === 'trades' && pendingTrades.map((req) => (
              <TradeApprovalCard
                key={req.id}
                trade={req}
                selected={selectedTrades.has(req.id)}
                onToggleSelect={() => toggleItem(req.id)}
                onApprove={() => handleApproveTrade(req.id)}
                onDeny={() => { setDenyTarget({ id: req.id, type: 'trades' }); setDenyReason('') }}
                isPending={reviewTrade.isPending}
              />
            ))}
          </div>
        </>
      )}

      {/* Deny reason dialog */}
      <Dialog open={!!denyTarget} onOpenChange={(open) => { if (!open) { setDenyTarget(null); setDenyReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny {denyTarget?.type === 'leave' ? 'Leave Request' : 'Trade'}</DialogTitle>
            <DialogDescription>
              Provide a reason for denying this request (optional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            placeholder="Reason for denial..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDenyTarget(null); setDenyReason('') }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDenyConfirm}
              disabled={reviewLeave.isPending || reviewTrade.isPending}
            >
              Deny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LeaveApprovalCard({
  request,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
  onApprove,
  onDeny,
  isPending,
}: {
  request: LeaveRequest
  selected: boolean
  expanded: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  onApprove: () => void
  onDeny: () => void
  isPending: boolean
}) {
  const hours = totalHours(request)

  return (
    <Card className={cn(selected && 'ring-2 ring-primary/30')}>
      <CardContent className="py-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="mt-1"
          />
          <button
            onClick={onToggleExpand}
            className="flex-1 text-left min-w-0"
          >
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">
                {request.first_name} {request.last_name}
              </p>
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {request.leave_type_name}
              {' \u00b7 '}
              {formatDateRange(request.start_date, request.end_date)}
              {hours > 0 && ` (${hours}h)`}
              {' \u00b7 Requested '}
              {timeAgo(request.created_at)}
            </p>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={onApprove}
              disabled={isPending}
              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDeny}
              disabled={isPending}
              className="text-destructive hover:bg-destructive/5 border-destructive/30"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Deny
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 ml-8 border-t pt-3 space-y-1.5 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Leave Type:</span>{' '}
                <span className="font-medium">{request.leave_type_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Hours:</span>{' '}
                <span className="font-medium">{hours}h</span>
              </div>
              <div>
                <span className="text-muted-foreground">Dates:</span>{' '}
                <span className="font-medium">{formatDateRange(request.start_date, request.end_date)}</span>
              </div>
              {request.is_rdo && (
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium">Regular Day Off</span>
                </div>
              )}
            </div>
            {request.reason && (
              <div>
                <span className="text-muted-foreground">Reason:</span>{' '}
                <span>{request.reason}</span>
              </div>
            )}
            {request.lines && request.lines.length > 1 && (
              <div>
                <span className="text-muted-foreground">Days:</span>
                <div className="mt-1 space-y-0.5 ml-2">
                  {request.lines.map((line) => (
                    <div key={line.id} className="text-xs text-muted-foreground">
                      {formatDate(line.date)} — {line.hours}h
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TradeApprovalCard({
  trade,
  selected,
  onToggleSelect,
  onApprove,
  onDeny,
  isPending,
}: {
  trade: TradeRequest
  selected: boolean
  onToggleSelect: () => void
  onApprove: () => void
  onDeny: () => void
  isPending: boolean
}) {
  return (
    <Card className={cn(selected && 'ring-2 ring-primary/30')}>
      <CardContent className="py-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {trade.requester_name} <span className="text-muted-foreground font-normal">\u2194</span> {trade.partner_name}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatDate(trade.requester_date)} \u2194 {formatDate(trade.partner_date)}
              {' \u00b7 Requested '}
              {timeAgo(trade.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={onApprove}
              disabled={isPending}
              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDeny}
              disabled={isPending}
              className="text-destructive hover:bg-destructive/5 border-destructive/30"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Deny
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
