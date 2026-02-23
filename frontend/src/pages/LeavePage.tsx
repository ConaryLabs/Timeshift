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
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { SearchInput } from '@/components/ui/search-input'
import { useDebounce } from '@/hooks/useDebounce'
import { useLeaveRequests, useLeaveTypes, useCreateLeave, useReviewLeave, useLeaveBalances } from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import type { LeaveRequest } from '@/api/leave'
import { Card, CardContent } from '@/components/ui/card'

const INITIAL_FORM = { leave_type_id: '', start_date: '', end_date: '', reason: '' }

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Denied', value: 'denied' },
]

type ReviewTarget = { id: string; action: 'approved' | 'denied' }

export default function LeavePage() {
  const { isManager } = usePermissions()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const debouncedSearch = useDebounce(search)

  const { data: requests, isLoading, isError } = useLeaveRequests()
  const { data: leaveTypes } = useLeaveTypes()
  const { data: balances } = useLeaveBalances()
  const createMut = useCreateLeave()
  const reviewMut = useReviewLeave()

  const selectedBalance = balances?.find((b) => b.leave_type_id === form.leave_type_id)

  const filteredRequests = useMemo(() => {
    let result = requests ?? []
    if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter)
    if (debouncedSearch && isManager) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter((r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
        `${r.last_name}, ${r.first_name}`.toLowerCase().includes(q)
      )
    }
    return result
  }, [requests, statusFilter, debouncedSearch, isManager])

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
          toast.success('Leave request submitted')
          setForm(INITIAL_FORM)
          setShowForm(false)
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to submit leave request'
          toast.error(msg)
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
      {
        onSuccess: () => {
          toast.success(reviewTarget.action === 'approved' ? 'Leave request approved' : 'Leave request denied')
          setReviewTarget(null)
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to review leave request'
          toast.error(msg)
        },
      },
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

      {!isManager && balances && balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {balances.map((b) => (
            <Card key={b.leave_type_id}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{b.leave_type_name}</p>
                <p className="text-2xl font-semibold mt-1">{b.balance_hours.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">hrs</span></p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
          {selectedBalance !== undefined && (
            <p className="text-xs text-muted-foreground self-end pb-2">
              Balance: <span className="font-medium text-foreground">{selectedBalance.balance_hours.toFixed(1)} hrs</span>
            </p>
          )}
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

      {isManager && <p className="text-sm text-muted-foreground mb-4">Viewing all employee requests</p>}

      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
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
        {isManager && (
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name..." className="w-56" />
        )}
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load leave requests.</p>
      ) : (
        <DataTable
          columns={columns}
          data={filteredRequests}
          isLoading={isLoading}
          emptyMessage={isManager ? 'No leave requests to review' : 'No leave requests yet'}
          emptyDescription={isManager ? 'Employee requests will appear here.' : 'Submit a request using the button above.'}
          emptyAction={!isManager ? (
            <Button onClick={() => setShowForm(true)}>+ Request Leave</Button>
          ) : undefined}
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
