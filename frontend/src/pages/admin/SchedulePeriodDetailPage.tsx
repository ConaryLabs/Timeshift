import { useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { FormField } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { Badge } from '@/components/ui/badge'
import {
  useSchedulePeriods,
  useSlotAssignments,
  useAssignSlot,
  useRemoveSlotAssignment,
  useUsers,
} from '@/hooks/queries'
import { formatTime } from '@/lib/format'
import { NO_VALUE } from '@/lib/format'
import type { SlotAssignmentView } from '@/api/schedulePeriods'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function SchedulePeriodDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [assignTarget, setAssignTarget] = useState<SlotAssignmentView | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>(NO_VALUE)
  const [removeTarget, setRemoveTarget] = useState<SlotAssignmentView | null>(null)

  const periodId = id ?? ''

  const { data: periods, isLoading: periodsLoading } = useSchedulePeriods()
  const { data: assignments, isLoading: assignmentsLoading, isError } = useSlotAssignments(periodId)
  const { data: users } = useUsers()
  const assignMut = useAssignSlot()
  const removeMut = useRemoveSlotAssignment()

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
      },
    )
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

  if (periodsLoading) return <LoadingState />

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
            ? `${formatDate(period.start_date)} – ${formatDate(period.end_date)}`
            : undefined
        }
      />

      {isError ? (
        <p className="text-sm text-destructive">Failed to load slot assignments.</p>
      ) : (
        <DataTable
          columns={columns}
          data={assignments ?? []}
          isLoading={assignmentsLoading}
          emptyMessage="No active shift slots found. Create teams and shift slots first."
          rowKey={(r) => r.slot_id}
        />
      )}

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
                <SelectValue placeholder="Select a user…" />
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
