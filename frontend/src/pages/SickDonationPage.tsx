// frontend/src/pages/SickDonationPage.tsx
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
import { useDonations, useCreateDonation, useReviewDonation, useCancelDonation, useUserDirectory, useLeaveTypes } from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import type { SickLeaveDonation } from '@/api/sickDonation'
import { extractApiError, formatDate } from '@/lib/format'

const INITIAL_FORM = { recipient_id: '', leave_type_id: '', hours: '', fiscal_year: new Date().getFullYear().toString() }

type ReviewTarget = { id: string; action: 'approved' | 'denied' }

const STATUS_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Denied', value: 'denied' },
]

export default function SickDonationPage() {
  const { isManager } = usePermissions()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [statusFilter, setStatusFilter] = useState('all')
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState('')

  const { confirmClose, confirmDialog } = useConfirmClose()

  const isDonationFormDirty = form.recipient_id !== '' || form.leave_type_id !== '' || form.hours !== ''

  const { data: donations, isLoading, isError } = useDonations()
  const { data: users } = useUserDirectory()
  const { data: leaveTypes } = useLeaveTypes()
  const createMut = useCreateDonation()
  const reviewMut = useReviewDonation()
  const cancelMut = useCancelDonation()

  const sickLeaveTypes = useMemo(
    () => (leaveTypes ?? []).filter((lt) => lt.category === 'sick' && lt.is_active),
    [leaveTypes],
  )

  const activeUsers = useMemo(
    () => (users ?? []).sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [users],
  )

  const filteredDonations = useMemo(() => {
    let result = donations ?? []
    if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter)
    return result
  }, [donations, statusFilter])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const hours = parseFloat(form.hours)
    if (!hours || hours <= 0) {
      toast.error('Hours must be a positive number')
      return
    }
    createMut.mutate(
      {
        recipient_id: form.recipient_id,
        leave_type_id: form.leave_type_id,
        hours,
        fiscal_year: parseInt(form.fiscal_year),
      },
      {
        onSuccess: () => {
          toast.success('Donation request submitted')
          setForm(INITIAL_FORM)
          setShowForm(false)
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to submit donation')
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
          toast.success(reviewTarget.action === 'approved' ? 'Donation approved' : 'Donation denied')
          setReviewTarget(null)
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to review donation')
          toast.error(msg)
        },
      },
    )
  }

  const userLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of users ?? []) map.set(u.id, `${u.last_name}, ${u.first_name}`)
    return map
  }, [users])

  const columns: Column<SickLeaveDonation>[] = [
    { header: 'Donor', cell: (r) => userLookup.get(r.donor_id) ?? r.donor_id.slice(0, 8) },
    { header: 'Recipient', cell: (r) => userLookup.get(r.recipient_id) ?? r.recipient_id.slice(0, 8) },
    { header: 'Hours', cell: (r) => r.hours.toFixed(1) },
    { header: 'FY', accessorKey: 'fiscal_year' },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Date', cell: (r) => formatDate(r.created_at) },
    ...(!isManager
      ? [{
          header: 'Actions',
          cell: (r: SickLeaveDonation) =>
            r.status === 'pending' ? (
              <Button
                size="sm"
                variant="outline"
                className="text-red-700 hover:bg-red-50"
                onClick={() =>
                  cancelMut.mutate(r.id, {
                    onSuccess: () => toast.success('Donation cancelled'),
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
          cell: (r: SickLeaveDonation) =>
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
        title="Sick Leave Donations"
        actions={
          !isManager ? (
            <Button
              onClick={() => {
                if (showForm) {
                  confirmClose(isDonationFormDirty, () => { setShowForm(false); setForm(INITIAL_FORM) })
                } else {
                  setShowForm(true)
                }
              }}
              variant={showForm ? 'outline' : 'default'}
            >
              {showForm ? 'Cancel' : '+ Donate Hours'}
            </Button>
          ) : undefined
        }
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border rounded-lg p-4 mb-6 flex flex-wrap items-end gap-4">
          <FormField label="Recipient" htmlFor="don-recipient" required>
            <Select value={form.recipient_id} onValueChange={(v) => setForm({ ...form, recipient_id: v })}>
              <SelectTrigger id="don-recipient" className="w-[220px]">
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent>
                {activeUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.last_name}, {u.first_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Sick Leave Type" htmlFor="don-type" required>
            <Select value={form.leave_type_id} onValueChange={(v) => setForm({ ...form, leave_type_id: v })}>
              <SelectTrigger id="don-type" className="w-[200px]">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {sickLeaveTypes.map((lt) => (
                  <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Hours" htmlFor="don-hours" required>
            <Input
              id="don-hours"
              type="number"
              step="0.5"
              min="0.5"
              className="w-[120px]"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Fiscal Year" htmlFor="don-fy" required>
            <Input
              id="don-fy"
              type="number"
              className="w-[120px]"
              value={form.fiscal_year}
              onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })}
              required
            />
          </FormField>
          <Button type="submit" disabled={createMut.isPending || !form.recipient_id || !form.leave_type_id}>
            {createMut.isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      )}

      {isManager && <p className="text-sm text-muted-foreground mb-4">Viewing all sick leave donations</p>}

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
        <ErrorState message="Failed to load donations." />
      ) : (
        <DataTable
          columns={columns}
          data={filteredDonations}
          isLoading={isLoading}
          emptyMessage="No donations"
          emptyDescription={isManager ? 'Employee donations will appear here.' : 'Submit a donation using the button above.'}
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.action === 'approved' ? 'Approve Donation' : 'Deny Donation'}
            </DialogTitle>
            <DialogDescription>Optionally add notes.</DialogDescription>
          </DialogHeader>
          <FormField label="Reviewer Notes" htmlFor="don-review-notes">
            <Textarea
              id="don-review-notes"
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
