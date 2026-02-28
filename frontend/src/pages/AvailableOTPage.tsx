import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  useOtRequests,
  useClassifications,
  useCreateOtRequest,
  useVolunteerOtRequest,
  useCancelOtRequest,
} from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuthStore } from '@/store/auth'
import { formatTime, formatDate, extractApiError } from '@/lib/format'
import type { OtRequest, OtRequestStatus } from '@/api/otRequests'

const STATUS_TABS: { label: string; value: OtRequestStatus | 'available' | 'all' }[] = [
  { label: 'Available', value: 'available' },
  { label: 'Filled', value: 'filled' },
  { label: 'All', value: 'all' },
]

const INITIAL_FORM = {
  date: '',
  start_time: '',
  end_time: '',
  classification_id: '',
  location: '',
  is_fixed_coverage: true,
  notes: '',
}

function computeHours(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMin = sh * 60 + sm
  let endMin = eh * 60 + em
  if (endMin <= startMin) endMin += 24 * 60 // handle overnight
  return Math.round(((endMin - startMin) / 60) * 100) / 100
}

export default function AvailableOTPage() {
  const user = useAuthStore((s) => s.user)
  const { isManager } = usePermissions()
  const [statusFilter, setStatusFilter] = useState<OtRequestStatus | 'available' | 'all'>('available')
  const [classFilter, setClassFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)

  const [pendingVolunteerId, setPendingVolunteerId] = useState<string | null>(null)
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)

  const { data: classifications } = useClassifications()

  const apiParams = useMemo(() => {
    const params: { status?: string; date_from?: string; date_to?: string; classification_id?: string } = {}
    if (statusFilter === 'available') {
      // Don't send status filter — fetch all, then client-side filter for open + partially_filled
    } else if (statusFilter !== 'all') {
      params.status = statusFilter
    }
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (classFilter && classFilter !== 'all') params.classification_id = classFilter
    return params
  }, [statusFilter, dateFrom, dateTo, classFilter])

  const { data: requests, isLoading, isError, refetch } = useOtRequests(apiParams)
  const createMut = useCreateOtRequest()
  const volunteerMut = useVolunteerOtRequest()
  const cancelMut = useCancelOtRequest()

  const displayedRequests = useMemo(() => {
    let result = requests ?? []
    // Client-side filter for 'available' includes 'open' and 'partially_filled'
    if (statusFilter === 'available') {
      result = result.filter((r) => r.status === 'open' || r.status === 'partially_filled')
    }
    return result
  }, [requests, statusFilter])

  const computedHours = computeHours(form.start_time, form.end_time)

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.date || !form.start_time || !form.end_time || !form.classification_id) return
    // HTML time inputs return "HH:MM"; backend expects "HH:MM:SS"
    const startTime = form.start_time.length === 5 ? form.start_time + ':00' : form.start_time
    const endTime = form.end_time.length === 5 ? form.end_time + ':00' : form.end_time
    createMut.mutate(
      {
        date: form.date,
        start_time: startTime,
        end_time: endTime,
        classification_id: form.classification_id,
        location: form.location || undefined,
        is_fixed_coverage: form.is_fixed_coverage,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('OT request created')
          setShowCreateDialog(false)
          setForm(INITIAL_FORM)
        },
        onError: (err: unknown) => {
          toast.error(extractApiError(err, 'Failed to create OT request'))
        },
      },
    )
  }

  function handleVolunteer(id: string) {
    setPendingVolunteerId(id)
    volunteerMut.mutate(id, {
      onSuccess: () => toast.success('Volunteered for OT'),
      onError: (err: unknown) => {
        toast.error(extractApiError(err, 'Failed to volunteer'))
      },
      onSettled: () => setPendingVolunteerId(null),
    })
  }

  function handleCancel(id: string) {
    setPendingCancelId(id)
    cancelMut.mutate(id, {
      onSuccess: () => toast.success('OT request cancelled'),
      onError: (err: unknown) => {
        toast.error(extractApiError(err, 'Failed to cancel OT request'))
      },
      onSettled: () => setPendingCancelId(null),
    })
  }

  const columns: Column<OtRequest>[] = [
    {
      header: 'Date',
      cell: (r) => (
        <Link to={`/ot-requests/${r.id}`} className="text-primary hover:underline font-medium">
          {formatDate(r.date)}
        </Link>
      ),
    },
    {
      header: 'Time',
      cell: (r) => `${formatTime(r.start_time)} - ${formatTime(r.end_time)}`,
    },
    {
      header: 'Hours',
      cell: (r) => r.hours.toFixed(1),
      className: 'tabular-nums',
    },
    {
      header: 'Position',
      cell: (r) => r.classification_name,
    },
    {
      header: 'Location',
      cell: (r) => r.location ?? '-',
      className: 'max-w-[120px] truncate',
    },
    {
      header: 'Volunteers',
      cell: (r) => (
        <span className="tabular-nums">{r.volunteer_count}</span>
      ),
    },
    {
      header: 'Assigned',
      cell: (r) => (
        <span className="tabular-nums">{r.assignment_count}</span>
      ),
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Actions',
      cell: (r) => {
        const actions: React.ReactNode[] = []
        if ((r.status === 'open' || r.status === 'partially_filled') && user) {
          if (r.user_volunteered) {
            actions.push(
              <Button
                key="volunteered"
                size="sm"
                variant="outline"
                className="text-green-700 border-green-200 bg-green-50 cursor-default"
                disabled
                aria-label={`Already volunteered for OT on ${formatDate(r.date)}`}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Volunteered
              </Button>,
            )
          } else {
            actions.push(
              <Button
                key="volunteer"
                size="sm"
                variant="outline"
                className="text-green-700 hover:bg-green-50"
                onClick={() => handleVolunteer(r.id)}
                disabled={pendingVolunteerId === r.id}
                aria-label={`Volunteer for OT on ${formatDate(r.date)}`}
              >
                Volunteer
              </Button>,
            )
          }
        }
        if (isManager && (r.status === 'open' || r.status === 'partially_filled')) {
          actions.push(
            <Button
              key="cancel"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => handleCancel(r.id)}
              disabled={pendingCancelId === r.id}
              aria-label={`Cancel OT request for ${formatDate(r.date)}`}
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
        title="Available Overtime"
        actions={
          isManager ? (
            <Button onClick={() => setShowCreateDialog(true)}>+ Create OT Request</Button>
          ) : undefined
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
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
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All positions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All positions</SelectItem>
            {(classifications ?? []).filter((c) => c.is_active).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[150px]"
          placeholder="From"
          aria-label="Date from"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[150px]"
          placeholder="To"
          aria-label="Date to"
        />
      </div>

      {isError ? (
        <ErrorState message="Failed to load OT requests." onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={displayedRequests}
          isLoading={isLoading}
          emptyMessage="No overtime requests"
          emptyDescription="No OT slots are currently available."
          rowKey={(r) => r.id}
        />
      )}

      {/* Create OT Request Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create OT Request</DialogTitle>
            <DialogDescription>
              Post an overtime slot for employees to volunteer for.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <FormField label="Date" htmlFor="ot-date" required>
              <Input
                id="ot-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </FormField>
            <div className="flex gap-4">
              <FormField label="Start Time" htmlFor="ot-start" required className="flex-1">
                <Input
                  id="ot-start"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="End Time" htmlFor="ot-end" required className="flex-1">
                <Input
                  id="ot-end"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  required
                />
              </FormField>
            </div>
            {computedHours > 0 && (
              <p className="text-sm text-muted-foreground">
                Duration: <span className="font-medium text-foreground">{computedHours.toFixed(1)} hours</span>
              </p>
            )}
            <FormField label="Classification" htmlFor="ot-classification" required>
              <Select
                value={form.classification_id}
                onValueChange={(v) => setForm({ ...form, classification_id: v })}
              >
                <SelectTrigger id="ot-classification">
                  <SelectValue placeholder="Select position..." />
                </SelectTrigger>
                <SelectContent>
                  {(classifications ?? []).filter((c) => c.is_active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Location" htmlFor="ot-location">
              <Input
                id="ot-location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Optional location..."
              />
            </FormField>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ot-fixed-coverage"
                checked={form.is_fixed_coverage}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_fixed_coverage: checked === true })
                }
              />
              <label htmlFor="ot-fixed-coverage" className="text-sm font-medium leading-none cursor-pointer">
                Fixed coverage
              </label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">Single-slot coverage — marks as filled after one assignment</p>
            <FormField label="Notes" htmlFor="ot-notes">
              <Textarea
                id="ot-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes..."
                rows={3}
              />
            </FormField>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false)
                  setForm(INITIAL_FORM)
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createMut.isPending ||
                  !form.date ||
                  !form.start_time ||
                  !form.end_time ||
                  !form.classification_id
                }
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
