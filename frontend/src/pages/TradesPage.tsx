import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import {
  useTrades,
  useUsers,
  useStaffing,
  useCreateTrade,
  useRespondTrade,
  useReviewTrade,
  useCancelTrade,
} from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuthStore } from '@/store/auth'
import type { TradeRequest, TradeStatus } from '@/api/trades'

const STATUS_TABS: { label: string; value: TradeStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending_partner' },
  { label: 'Awaiting Approval', value: 'pending_approval' },
  { label: 'Approved', value: 'approved' },
  { label: 'Denied', value: 'denied' },
]

type ReviewTarget = { id: string; action: 'approve' | 'deny' }

export default function TradesPage() {
  const user = useAuthStore((s) => s.user)
  const { isManager } = usePermissions()
  const [statusFilter, setStatusFilter] = useState<TradeStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState('')

  // Form state for new trade
  const [partnerId, setPartnerId] = useState('')
  const [myAssignmentId, setMyAssignmentId] = useState('')
  const [partnerAssignmentId, setPartnerAssignmentId] = useState('')

  const tradeParams = statusFilter === 'all' ? undefined : { status: statusFilter }
  const { data: trades, isLoading, isError } = useTrades(tradeParams)
  const { data: allUsers } = useUsers()

  // Compute a 30-day window for assignment lookups
  const today = new Date()
  const futureDate = new Date(today)
  futureDate.setDate(futureDate.getDate() + 60)
  const startStr = today.toISOString().slice(0, 10)
  const endStr = futureDate.toISOString().slice(0, 10)

  const { data: staffing } = useStaffing(startStr, endStr)

  const createMut = useCreateTrade()
  const respondMut = useRespondTrade()
  const reviewMut = useReviewTrade()
  const cancelMut = useCancelTrade()

  // Filter my assignments from staffing data
  const myAssignments = useMemo(
    () => (staffing ?? []).filter((a) => a.user_id === user?.id),
    [staffing, user?.id],
  )

  // Filter partner assignments
  const partnerAssignments = useMemo(
    () => (staffing ?? []).filter((a) => a.user_id === partnerId),
    [staffing, partnerId],
  )

  // Other active users (exclude self)
  const otherUsers = useMemo(
    () => (allUsers ?? []).filter((u) => u.id !== user?.id && u.is_active),
    [allUsers, user?.id],
  )

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partnerId || !myAssignmentId || !partnerAssignmentId) return
    createMut.mutate(
      {
        partner_id: partnerId,
        requester_assignment_id: myAssignmentId,
        partner_assignment_id: partnerAssignmentId,
      },
      {
        onSuccess: () => {
          toast.success('Trade request submitted')
          setShowForm(false)
          setPartnerId('')
          setMyAssignmentId('')
          setPartnerAssignmentId('')
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create trade request'
          toast.error(msg)
        },
      },
    )
  }

  function openReview(id: string, action: 'approve' | 'deny') {
    setReviewerNotes('')
    setReviewTarget({ id, action })
  }

  function handleReview() {
    if (!reviewTarget) return
    reviewMut.mutate(
      {
        id: reviewTarget.id,
        approve: reviewTarget.action === 'approve',
        reviewer_notes: reviewerNotes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(reviewTarget.action === 'approve' ? 'Trade approved' : 'Trade denied')
          setReviewTarget(null)
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to review trade'
          toast.error(msg)
        },
      },
    )
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const columns: Column<TradeRequest>[] = [
    {
      header: 'Requester',
      cell: (r) => r.requester_name,
      className: 'max-w-[120px] truncate',
    },
    {
      header: 'Requester Date',
      cell: (r) => formatDate(r.requester_date),
    },
    {
      header: 'Partner',
      cell: (r) => r.partner_name,
      className: 'max-w-[120px] truncate',
    },
    {
      header: 'Partner Date',
      cell: (r) => formatDate(r.partner_date),
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Actions',
      cell: (r) => {
        const actions: React.ReactNode[] = []

        // Partner can accept/decline when pending_partner
        if (r.status === 'pending_partner' && r.partner_id === user?.id) {
          actions.push(
            <Button
              key="accept"
              size="sm"
              variant="outline"
              className="text-green-700 hover:bg-green-50"
              onClick={() => respondMut.mutate({ id: r.id, accept: true }, {
                onSuccess: () => toast.success('Trade accepted'),
                onError: (err: unknown) => {
                  const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to accept trade'
                  toast.error(msg)
                },
              })}
              disabled={respondMut.isPending}
            >
              Accept
            </Button>,
            <Button
              key="decline"
              size="sm"
              variant="outline"
              className="text-red-700 hover:bg-red-50"
              onClick={() => respondMut.mutate({ id: r.id, accept: false }, {
                onSuccess: () => toast.success('Trade declined'),
                onError: (err: unknown) => {
                  const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to decline trade'
                  toast.error(msg)
                },
              })}
              disabled={respondMut.isPending}
            >
              Decline
            </Button>,
          )
        }

        // Manager can approve/deny when pending_approval
        if (r.status === 'pending_approval' && isManager) {
          actions.push(
            <Button
              key="approve"
              size="sm"
              variant="outline"
              className="text-green-700 hover:bg-green-50"
              onClick={() => openReview(r.id, 'approve')}
            >
              Approve
            </Button>,
            <Button
              key="deny"
              size="sm"
              variant="outline"
              className="text-red-700 hover:bg-red-50"
              onClick={() => openReview(r.id, 'deny')}
            >
              Deny
            </Button>,
          )
        }

        // Requester can cancel when pending
        if (
          (r.status === 'pending_partner' || r.status === 'pending_approval') &&
          r.requester_id === user?.id
        ) {
          actions.push(
            <Button
              key="cancel"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => cancelMut.mutate(r.id, {
                onSuccess: () => toast.success('Trade cancelled'),
                onError: (err: unknown) => {
                  const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to cancel trade'
                  toast.error(msg)
                },
              })}
              disabled={cancelMut.isPending}
            >
              Cancel
            </Button>,
          )
        }

        return actions.length > 0 ? <div className="flex gap-1">{actions}</div> : null
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Shift Trades"
        actions={
          <Button
            onClick={() => setShowForm((v) => !v)}
            variant={showForm ? 'outline' : 'default'}
          >
            {showForm ? 'Cancel' : '+ New Trade'}
          </Button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-card border rounded-lg p-4 mb-6 space-y-4"
        >
          <div className="flex flex-wrap items-end gap-4">
            <FormField label="Trade Partner" htmlFor="trade-partner" required>
              <Select
                value={partnerId}
                onValueChange={(v) => {
                  setPartnerId(v)
                  setPartnerAssignmentId('')
                }}
              >
                <SelectTrigger id="trade-partner" className="w-[220px]">
                  <SelectValue placeholder="Select partner..." />
                </SelectTrigger>
                <SelectContent>
                  {otherUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.last_name}, {u.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Your Assignment" htmlFor="my-assignment" required>
              <Select value={myAssignmentId} onValueChange={setMyAssignmentId}>
                <SelectTrigger id="my-assignment" className="w-[280px]">
                  <SelectValue placeholder="Select your shift..." />
                </SelectTrigger>
                <SelectContent>
                  {myAssignments.map((a) => (
                    <SelectItem key={a.assignment_id} value={a.assignment_id}>
                      {a.date} - {a.shift_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {partnerId && (
              <FormField label="Partner's Assignment" htmlFor="partner-assignment" required>
                <Select value={partnerAssignmentId} onValueChange={setPartnerAssignmentId}>
                  <SelectTrigger id="partner-assignment" className="w-[280px]">
                    <SelectValue placeholder="Select partner's shift..." />
                  </SelectTrigger>
                  <SelectContent>
                    {partnerAssignments.map((a) => (
                      <SelectItem key={a.assignment_id} value={a.assignment_id}>
                        {a.date} - {a.shift_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </div>

          <Button
            type="submit"
            disabled={createMut.isPending || !partnerId || !myAssignmentId || !partnerAssignmentId}
          >
            Submit Trade Request
          </Button>
          {createMut.isError && (
            <p className="text-sm text-destructive mt-1">
              {(createMut.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create trade request'}
            </p>
          )}
        </form>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4">
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

      {isError ? (
        <p className="text-sm text-destructive">Failed to load trade requests.</p>
      ) : (
        <DataTable
          columns={columns}
          data={trades ?? []}
          isLoading={isLoading}
          emptyMessage="No trade requests"
          rowKey={(r) => r.id}
        />
      )}

      {/* Review dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.action === 'approve' ? 'Approve Trade' : 'Deny Trade'}
            </DialogTitle>
            <DialogDescription>
              Optionally add notes about this decision.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Notes" htmlFor="trade-review-notes">
            <Textarea
              id="trade-review-notes"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewTarget?.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={reviewMut.isPending}
            >
              {reviewTarget?.action === 'approve' ? 'Approve' : 'Deny'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
