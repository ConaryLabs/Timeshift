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
import { useLeaveRequests, useLeaveTypes, useCreateLeave, useReviewLeave, useBulkReviewLeave, useLeaveBalances } from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import type { LeaveRequest, CreateLeaveSegment } from '@/api/leave'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { extractApiError } from '@/lib/format'

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Denied', value: 'denied' },
]

// Leave type codes that trigger conditional fields
const BEREAVEMENT_CODES = ['bereavement']
const EMERGENCY_CODES = ['sick', 'fmla_sick', 'emergency_leave']

type ReviewTarget = { id: string; action: 'approved' | 'denied' }

interface LeaveFormState {
  // Step 1: Dates
  start_date: string
  end_date: string
  is_rdo: boolean
  // Step 2: Details
  leave_type_id: string
  hours: string
  start_time: string
  reason: string
  emergency_contact: string
  bereavement_relationship: string
  bereavement_name: string
  // Split coding
  use_split: boolean
  segments: CreateLeaveSegment[]
}

const INITIAL_FORM: LeaveFormState = {
  start_date: '',
  end_date: '',
  is_rdo: false,
  leave_type_id: '',
  hours: '',
  start_time: '',
  reason: '',
  emergency_contact: '',
  bereavement_relationship: '',
  bereavement_name: '',
  use_split: false,
  segments: [],
}

export default function LeavePage() {
  const { isManager } = usePermissions()
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<LeaveFormState>(INITIAL_FORM)
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
  const bulkReviewMut = useBulkReviewLeave()

  const selectedType = leaveTypes?.find((t) => t.id === form.leave_type_id)
  const selectedBalance = balances?.find((b) => b.leave_type_id === form.leave_type_id)
  const showBereavement = selectedType && BEREAVEMENT_CODES.includes(selectedType.code)
  const showEmergency = selectedType && EMERGENCY_CODES.includes(selectedType.code)

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

  function openForm() {
    setForm(INITIAL_FORM)
    setStep(1)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setForm(INITIAL_FORM)
    setStep(1)
  }

  function handleStep1Continue() {
    if (!form.start_date || !form.end_date) {
      toast.error('Start and end dates are required')
      return
    }
    if (form.end_date < form.start_date) {
      toast.error('End date must be on or after start date')
      return
    }
    setStep(2)
  }

  function addSegment() {
    if (form.segments.length >= 5) return
    setForm({ ...form, segments: [...form.segments, { leave_type_id: '', hours: 0 }] })
  }

  function removeSegment(idx: number) {
    setForm({ ...form, segments: form.segments.filter((_, i) => i !== idx) })
  }

  function updateSegment(idx: number, field: keyof CreateLeaveSegment, value: string | number) {
    const updated = [...form.segments]
    updated[idx] = { ...updated[idx], [field]: value }
    setForm({ ...form, segments: updated })
  }

  function handleSubmit() {
    if (!form.leave_type_id && !form.use_split) {
      toast.error('Leave type is required')
      return
    }
    const hours = form.hours ? parseFloat(form.hours) : undefined
    const startTime = form.start_time || undefined

    const segments = form.use_split && form.segments.length > 0
      ? form.segments.filter((s) => s.leave_type_id && s.hours > 0)
      : undefined

    createMut.mutate(
      {
        leave_type_id: form.leave_type_id,
        start_date: form.start_date,
        end_date: form.end_date,
        hours,
        start_time: startTime,
        is_rdo: form.is_rdo || undefined,
        reason: form.reason || undefined,
        emergency_contact: form.emergency_contact || undefined,
        bereavement_relationship: form.bereavement_relationship || undefined,
        bereavement_name: form.bereavement_name || undefined,
        segments,
      },
      {
        onSuccess: () => {
          toast.success('Leave request submitted')
          closeForm()
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to submit leave request')
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
          const msg = extractApiError(err, 'Failed to review leave request')
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
    {
      header: 'Hours',
      cell: (r) => r.hours != null ? r.hours.toFixed(1) : '-',
    },
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
            <Button onClick={openForm}>+ Request Leave</Button>
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
            <Button onClick={openForm}>+ Request Leave</Button>
          ) : undefined}
          rowKey={(r) => r.id}
          selectable={isManager && statusFilter === 'pending'}
          toolbar={isManager && statusFilter === 'pending' ? (selectedKeys) => (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selectedKeys.size} selected</span>
              <Button
                size="sm"
                variant="outline"
                className="text-green-700 hover:bg-green-50"
                disabled={bulkReviewMut.isPending}
                onClick={() => bulkReviewMut.mutate(
                  { ids: [...selectedKeys], status: 'approved' },
                  {
                    onSuccess: (data) => {
                      toast.success(`${data.reviewed} request(s) approved`)
                    },
                    onError: () => toast.error('Failed to bulk approve'),
                  },
                )}
              >
                Approve All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-700 hover:bg-red-50"
                disabled={bulkReviewMut.isPending}
                onClick={() => bulkReviewMut.mutate(
                  { ids: [...selectedKeys], status: 'denied' },
                  {
                    onSuccess: (data) => {
                      toast.success(`${data.reviewed} request(s) denied`)
                    },
                    onError: () => toast.error('Failed to bulk deny'),
                  },
                )}
              >
                Deny All
              </Button>
            </div>
          ) : undefined}
        />
      )}

      {/* Multi-step Leave Request Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {step === 1 ? 'New Leave Request' : 'Leave Details'}
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? 'Select the dates for your absence.'
                : 'Fill in the details for your leave request.'}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Date" htmlFor="lr-start" required>
                  <Input
                    id="lr-start"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: form.end_date || e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="End Date" htmlFor="lr-end" required>
                  <Input
                    id="lr-end"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    min={form.start_date}
                    required
                  />
                </FormField>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lr-rdo"
                  checked={form.is_rdo}
                  onCheckedChange={(v) => setForm({ ...form, is_rdo: v === true })}
                />
                <Label htmlFor="lr-rdo" className="text-sm cursor-pointer">
                  Include RDO (Regular Day Off)
                </Label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeForm}>Cancel</Button>
                <Button onClick={handleStep1Continue}>Continue</Button>
              </DialogFooter>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Leave Type */}
              <FormField label="Leave Type" htmlFor="lr-type" required>
                <Select value={form.leave_type_id} onValueChange={(v) => setForm({ ...form, leave_type_id: v })}>
                  <SelectTrigger id="lr-type">
                    <SelectValue placeholder="Select leave type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(leaveTypes ?? []).map((lt) => (
                      <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {selectedBalance !== undefined && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Available balance: <span className="font-medium text-foreground">{selectedBalance.balance_hours.toFixed(1)} hrs</span>
                </p>
              )}

              {/* Hours and Start Time */}
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Hours Requested" htmlFor="lr-hours">
                  <Input
                    id="lr-hours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    placeholder="e.g. 10"
                    value={form.hours}
                    onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  />
                </FormField>
                <FormField label="Starting At (24hr)" htmlFor="lr-start-time">
                  <Input
                    id="lr-start-time"
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </FormField>
              </div>

              {/* Reason */}
              <FormField label="Reason" htmlFor="lr-reason">
                <Textarea
                  id="lr-reason"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Optional reason for absence..."
                  rows={2}
                />
              </FormField>

              {/* Conditional: Bereavement fields */}
              {showBereavement && (
                <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Bereavement Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Relationship" htmlFor="lr-relationship">
                      <Input
                        id="lr-relationship"
                        value={form.bereavement_relationship}
                        onChange={(e) => setForm({ ...form, bereavement_relationship: e.target.value })}
                        placeholder="e.g. Spouse, Parent"
                      />
                    </FormField>
                    <FormField label="Name of Deceased" htmlFor="lr-deceased">
                      <Input
                        id="lr-deceased"
                        value={form.bereavement_name}
                        onChange={(e) => setForm({ ...form, bereavement_name: e.target.value })}
                      />
                    </FormField>
                  </div>
                </div>
              )}

              {/* Conditional: Emergency contact */}
              {showEmergency && (
                <FormField label="Emergency Contact" htmlFor="lr-emergency">
                  <Input
                    id="lr-emergency"
                    value={form.emergency_contact}
                    onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                    placeholder="Phone number(s) or location where you can be reached"
                  />
                </FormField>
              )}

              {/* Split Coding */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="lr-split"
                    checked={form.use_split}
                    onCheckedChange={(v) => {
                      const useSplit = v === true
                      setForm({
                        ...form,
                        use_split: useSplit,
                        segments: useSplit && form.segments.length === 0
                          ? [{ leave_type_id: form.leave_type_id, hours: form.hours ? parseFloat(form.hours) : 0 }]
                          : form.segments,
                      })
                    }}
                  />
                  <Label htmlFor="lr-split" className="text-sm cursor-pointer">
                    Split across multiple leave types
                  </Label>
                </div>

                {form.use_split && (
                  <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                    {form.segments.map((seg, idx) => (
                      <div key={idx} className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">Type</Label>
                          <Select value={seg.leave_type_id} onValueChange={(v) => updateSegment(idx, 'leave_type_id', v)}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(leaveTypes ?? []).map((lt) => (
                                <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24">
                          <Label className="text-xs">Hours</Label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            className="h-9 text-sm"
                            value={seg.hours || ''}
                            onChange={(e) => updateSegment(idx, 'hours', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSegment(idx)}
                        >
                          X
                        </Button>
                      </div>
                    ))}
                    {form.segments.length < 5 && (
                      <Button type="button" variant="outline" size="sm" onClick={addSegment}>
                        + Add Type
                      </Button>
                    )}
                    {form.hours && (
                      <p className="text-xs text-muted-foreground">
                        Total: {form.segments.reduce((sum, s) => sum + (s.hours || 0), 0).toFixed(1)} / {parseFloat(form.hours).toFixed(1)} hrs
                      </p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMut.isPending || (!form.leave_type_id && !form.use_split)}
                >
                  {createMut.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
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
    </div>
  )
}
