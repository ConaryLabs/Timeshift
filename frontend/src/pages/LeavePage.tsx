import { useState } from 'react'
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
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { useLeaveRequests, useLeaveTypes, useCreateLeave, useReviewLeave } from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import type { LeaveRequest } from '@/api/leave'

const INITIAL_FORM = { leave_type_id: '', start_date: '', end_date: '', reason: '' }

type ReviewTarget = { id: string; action: 'approved' | 'denied' }

export default function LeavePage() {
  const { isManager } = usePermissions()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState('')

  const { data: requests, isLoading, isError } = useLeaveRequests()
  const { data: leaveTypes } = useLeaveTypes()
  const createMut = useCreateLeave()
  const reviewMut = useReviewLeave()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMut.mutate(
      {
        leave_type_id: form.leave_type_id,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || undefined,
      },
      {
        onSuccess: () => {
          setForm(INITIAL_FORM)
          setShowForm(false)
        },
      },
    )
  }

  function openReview(id: string, action: 'approved' | 'denied') {
    setReviewerNotes('')
    setReviewTarget({ id, action })
  }

  function handleReview() {
    if (!reviewTarget) return
    reviewMut.mutate(
      { id: reviewTarget.id, status: reviewTarget.action, reviewer_notes: reviewerNotes || undefined },
      { onSuccess: () => setReviewTarget(null) },
    )
  }

  const columns: Column<LeaveRequest>[] = [
    ...(isManager
      ? [{
          header: 'Employee',
          cell: (r: LeaveRequest) => `${r.last_name}, ${r.first_name}`,
          className: 'max-w-[120px] truncate',
        }]
      : []),
    { header: 'Type', cell: (r) => r.leave_type_name },
    { header: 'Start', accessorKey: 'start_date' },
    { header: 'End', accessorKey: 'end_date' },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    ...(isManager
      ? [{
          header: 'Actions',
          cell: (r: LeaveRequest) =>
            r.status === 'pending' ? (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 hover:bg-green-50"
                  onClick={() => openReview(r.id, 'approved')}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700 hover:bg-red-50"
                  onClick={() => openReview(r.id, 'denied')}
                >
                  Deny
                </Button>
              </div>
            ) : null,
        }]
      : []),
  ]

  return (
    <div>
      <PageHeader
        title="Leave Requests"
        actions={
          !isManager ? (
            <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'outline' : 'default'}>
              {showForm ? 'Cancel' : '+ Request Leave'}
            </Button>
          ) : undefined
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-card border rounded-lg p-4 mb-6 flex flex-wrap items-end gap-4"
        >
          <FormField label="Type" htmlFor="leave-type" required>
            <Select value={form.leave_type_id} onValueChange={(v) => setForm({ ...form, leave_type_id: v })}>
              <SelectTrigger id="leave-type" className="w-[200px]">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {(leaveTypes ?? []).map((lt) => (
                  <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Start" htmlFor="leave-start" required>
            <Input id="leave-start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
          </FormField>
          <FormField label="End" htmlFor="leave-end" required>
            <Input id="leave-end" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
          </FormField>
          <FormField label="Reason" htmlFor="leave-reason">
            <Input id="leave-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </FormField>
          <Button type="submit" disabled={createMut.isPending || !form.leave_type_id}>
            Submit
          </Button>
        </form>
      )}

      {isError ? (
        <p className="text-sm text-destructive">Failed to load leave requests.</p>
      ) : (
        <DataTable
          columns={columns}
          data={requests ?? []}
          isLoading={isLoading}
          emptyMessage="No leave requests"
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.action === 'approved' ? 'Approve Request' : 'Deny Request'}
            </DialogTitle>
            <DialogDescription>
              Optionally add notes for the employee.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Reviewer Notes" htmlFor="reviewer-notes">
            <Textarea
              id="reviewer-notes"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="Optional notes…"
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
    </div>
  )
}
