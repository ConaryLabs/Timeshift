// frontend/src/pages/LeaveSellbackPage.tsx
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { ErrorState } from '@/components/ui/error-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { useSellbackRequests, useCreateSellback, useReviewSellback, useCancelSellback } from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import type { HolidaySellbackRequest } from '@/api/leaveSellback'
import { extractApiError, formatDate } from '@/lib/format'

const INITIAL_FORM = { fiscal_year: new Date().getFullYear().toString(), period: '', hours_requested: '' }

type ReviewTarget = { id: string; action: 'approved' | 'denied' }

const STATUS_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Denied', value: 'denied' },
]

export default function LeaveSellbackPage() {
  const { isManager } = usePermissions()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [statusFilter, setStatusFilter] = useState('all')
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState('')

  const { confirmClose, confirmDialog } = useConfirmClose()

  const isSellbackFormDirty = form.period !== '' || form.hours_requested !== ''

  const { data: requests, isLoading, isError } = useSellbackRequests()
  const createMut = useCreateSellback()
  const reviewMut = useReviewSellback()
  const cancelMut = useCancelSellback()

  const filteredRequests = useMemo(() => {
    let result = requests ?? []
    if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter)
    return result
  }, [requests, statusFilter])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const hours = parseFloat(form.hours_requested)
    if (!hours || hours <= 0) {
      toast.error('Hours must be a positive number')
      return
    }
    createMut.mutate(
      {
        fiscal_year: parseInt(form.fiscal_year),
        period: form.period,
        hours_requested: hours,
      },
      {
        onSuccess: () => {
          toast.success('Sellback request submitted')
          setForm(INITIAL_FORM)
          setShowForm(false)
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to submit request')
          toast.error(msg)
        },
      },
    )
  }

  function handleReview() {
    if (!reviewTarget) return
    reviewMut.mutate(
      { id: reviewTarget.id, status: reviewTarget.action, reviewer_notes: reviewerNotes || undefined },
      {
        onSuccess: () => {
          toast.success(reviewTarget.action === 'approved' ? 'Request approved' : 'Request denied')
          setReviewTarget(null)
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to review request')
          toast.error(msg)
        },
      },
    )
  }

  const columns: Column<HolidaySellbackRequest>[] = [
    { header: 'Fiscal Year', accessorKey: 'fiscal_year' },
    { header: 'Period', cell: (r) => r.period.charAt(0).toUpperCase() + r.period.slice(1) },
    { header: 'Hours', cell: (r) => r.hours_requested.toFixed(1) },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Submitted', cell: (r) => formatDate(r.created_at) },
    ...(!isManager
      ? [{
          header: 'Actions',
          cell: (r: HolidaySellbackRequest) =>
            r.status === 'pending' ? (
              <Button
                size="sm"
                variant="outline"
                className="text-red-700 hover:bg-red-50"
                onClick={() =>
                  cancelMut.mutate(r.id, {
                    onSuccess: () => toast.success('Request cancelled'),
                    onError: () => toast.error('Failed to cancel'),
                  })
                }
              >
                Cancel
              </Button>
            ) : null,
        }]
      : [{
          header: 'Actions',
          cell: (r: HolidaySellbackRequest) =>
            r.status === 'pending' ? (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 hover:bg-green-50"
                  onClick={() => { setReviewerNotes(''); setReviewTarget({ id: r.id, action: 'approved' }) }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700 hover:bg-red-50"
                  onClick={() => { setReviewerNotes(''); setReviewTarget({ id: r.id, action: 'denied' }) }}
                >
                  Deny
                </Button>
              </div>
            ) : null,
        }]),
  ]

  return (
    <div>
      <PageHeader
        title="Holiday Sellback"
        actions={
          !isManager ? (
            <Button
              onClick={() => {
                if (showForm) {
                  confirmClose(isSellbackFormDirty, () => { setShowForm(false); setForm(INITIAL_FORM) })
                } else {
                  setShowForm(true)
                }
              }}
              variant={showForm ? 'outline' : 'default'}
            >
              {showForm ? 'Cancel' : '+ Sell Back Hours'}
            </Button>
          ) : undefined
        }
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border rounded-lg p-4 mb-6 flex flex-wrap items-end gap-4">
          <FormField label="Fiscal Year" htmlFor="sb-fy" required>
            <Input
              id="sb-fy"
              type="number"
              className="w-[120px]"
              value={form.fiscal_year}
              onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Period" htmlFor="sb-period" required>
            <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
              <SelectTrigger id="sb-period" className="w-[160px]">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="june">June</SelectItem>
                <SelectItem value="december">December</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Hours" htmlFor="sb-hours" required>
            <Input
              id="sb-hours"
              type="number"
              step="0.5"
              min="0.5"
              className="w-[120px]"
              value={form.hours_requested}
              onChange={(e) => setForm({ ...form, hours_requested: e.target.value })}
              required
            />
          </FormField>
          <Button type="submit" disabled={createMut.isPending || !form.period}>
            {createMut.isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      )}

      {isManager && <p className="text-sm text-muted-foreground mb-4">Viewing all employee sellback requests</p>}

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
        <ErrorState message="Failed to load sellback requests." />
      ) : (
        <DataTable
          columns={columns}
          data={filteredRequests}
          isLoading={isLoading}
          emptyMessage="No sellback requests"
          emptyDescription={isManager ? 'Employee requests will appear here.' : 'Submit a request using the button above.'}
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.action === 'approved' ? 'Approve Sellback' : 'Deny Sellback'}
            </DialogTitle>
            <DialogDescription>Optionally add notes for the employee.</DialogDescription>
          </DialogHeader>
          <FormField label="Reviewer Notes" htmlFor="sb-review-notes">
            <Textarea
              id="sb-review-notes"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button
              variant={reviewTarget?.action === 'approved' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={reviewMut.isPending}
            >
              {reviewTarget?.action === 'approved' ? 'Approve' : 'Deny'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  )
}
