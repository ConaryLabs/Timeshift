import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { FormField } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  useClassifications,
  useOtQueue,
  useSetOtQueuePosition,
  useOtHours,
  useAdjustOtHours,
} from '@/hooks/queries'
import { NO_VALUE, extractApiError } from '@/lib/format'
import type { OtQueueEntry, OtHoursEntry } from '@/api/ot'

const currentYear = new Date().getFullYear()
const FISCAL_YEARS = [currentYear - 1, currentYear, currentYear + 1]

export default function OTQueuePage() {
  const [selectedClassification, setSelectedClassification] = useState(NO_VALUE)
  const [fiscalYear, setFiscalYear] = useState(currentYear)
  const [pendingMoveToFront, setPendingMoveToFront] = useState<OtQueueEntry | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<OtHoursEntry | null>(null)
  const [adjustWorked, setAdjustWorked] = useState('')
  const [adjustDeclined, setAdjustDeclined] = useState('')

  const { data: classifications } = useClassifications()
  const classId = selectedClassification !== NO_VALUE ? selectedClassification : ''
  const { data: queue = [], isLoading: queueLoading } = useOtQueue(classId, fiscalYear)
  const setPositionMut = useSetOtQueuePosition()
  const { data: hoursData, isLoading: hoursLoading } = useOtHours({ fiscal_year: fiscalYear })
  const adjustMut = useAdjustOtHours()

  function handleMoveToFront(entry: OtQueueEntry) {
    setPendingMoveToFront(entry)
  }

  function confirmMoveToFront() {
    if (!pendingMoveToFront) return
    const entry = pendingMoveToFront
    setPendingMoveToFront(null)
    setPositionMut.mutate(
      {
        classification_id: classId,
        fiscal_year: fiscalYear,
        user_id: entry.user_id,
        last_ot_event_at: null,
      },
      {
        onSuccess: () => toast.success(`${entry.last_name}, ${entry.first_name} moved to front`),
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Operation failed')
          toast.error(msg)
        },
      },
    )
  }

  function handleAdjustSubmit() {
    if (!adjustTarget) return
    const workedDelta = adjustWorked ? parseFloat(adjustWorked) : undefined
    const declinedDelta = adjustDeclined ? parseFloat(adjustDeclined) : undefined
    if (!workedDelta && !declinedDelta) {
      toast.error('Enter at least one adjustment value')
      return
    }
    adjustMut.mutate(
      {
        user_id: adjustTarget.user_id,
        fiscal_year: adjustTarget.fiscal_year,
        classification_id: adjustTarget.classification_id ?? undefined,
        hours_worked_delta: workedDelta,
        hours_declined_delta: declinedDelta,
      },
      {
        onSuccess: () => {
          toast.success('OT hours adjusted')
          setAdjustTarget(null)
          setAdjustWorked('')
          setAdjustDeclined('')
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Operation failed')
          toast.error(msg)
        },
      },
    )
  }

  function handleClassificationChange(value: string) {
    setSelectedClassification(value)
  }

  function handleFiscalYearChange(value: string) {
    setFiscalYear(parseInt(value, 10))
  }

  const queueColumns: Column<OtQueueEntry>[] = [
    {
      header: 'Name',
      cell: (r) => (
        <div>
          {r.last_name}, {r.first_name}
          {r.employee_id && (
            <span className="block text-xs text-muted-foreground">{r.employee_id}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Last Called',
      cell: (r) =>
        r.last_ot_event_at
          ? new Date(r.last_ot_event_at).toLocaleDateString()
          : <span className="text-muted-foreground">Never</span>,
    },
    {
      header: 'OT Worked',
      cell: (r) => r.ot_hours_worked.toFixed(1),
      className: 'text-right',
    },
    {
      header: 'OT Declined',
      cell: (r) => r.ot_hours_declined.toFixed(1),
      className: 'text-right',
    },
    {
      header: '',
      cell: (r) => (
        <Button
          size="sm"
          variant="outline"
          disabled={setPositionMut.isPending || r.last_ot_event_at === null}
          onClick={() => handleMoveToFront(r)}
        >
          Move to Front
        </Button>
      ),
      className: 'w-36',
    },
  ]

  const hoursColumns: Column<OtHoursEntry>[] = [
    {
      header: 'Name',
      cell: (r) => `${r.last_name}, ${r.first_name}`,
    },
    {
      header: 'Classification',
      cell: (r) => r.classification_name ?? 'General',
    },
    {
      header: 'Worked',
      cell: (r) => r.hours_worked.toFixed(1),
      className: 'text-right',
    },
    {
      header: 'Declined',
      cell: (r) => r.hours_declined.toFixed(1),
      className: 'text-right',
    },
    {
      header: 'Actions',
      cell: (r) => (
        <Button size="sm" variant="outline" onClick={() => setAdjustTarget(r)}>
          Adjust
        </Button>
      ),
      className: 'w-24',
    },
  ]

  return (
    <div>
      <PageHeader
        title="OT Queue"
        description="Manage overtime queue positions and hours by classification"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="w-64">
          <FormField label="Classification" htmlFor="ot-class">
            <Select value={selectedClassification} onValueChange={handleClassificationChange}>
              <SelectTrigger id="ot-class">
                <SelectValue placeholder="Select classification…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VALUE}>Select classification…</SelectItem>
                {(classifications ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.abbreviation})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="w-36">
          <FormField label="Fiscal Year" htmlFor="ot-fy">
            <Select value={String(fiscalYear)} onValueChange={handleFiscalYearChange}>
              <SelectTrigger id="ot-fy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FISCAL_YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Queue section */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Queue Order</h3>

          {classId === '' ? (
            <EmptyState title="Select a classification" description="Choose a classification to view the OT queue" />
          ) : queueLoading ? (
            <LoadingState />
          ) : queue.length === 0 ? (
            <EmptyState title="No queue entries" description="No employees in the OT queue for this classification and fiscal year" />
          ) : (
            <DataTable
              columns={queueColumns}
              data={queue}
              rowKey={(r) => r.user_id}
              emptyMessage="No queue entries"
            />
          )}
        </div>

        {/* OT Hours section */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            OT Hours — FY {fiscalYear}
          </h3>

          {hoursLoading ? (
            <LoadingState />
          ) : (hoursData ?? []).length === 0 ? (
            <EmptyState title="No OT hours recorded" />
          ) : (
            <DataTable
              columns={hoursColumns}
              data={hoursData ?? []}
              rowKey={(r) => `${r.user_id}-${r.classification_id ?? 'general'}`}
              emptyMessage="No OT hours"
            />
          )}
        </div>
      </div>

      {/* Move to Front confirmation */}
      <AlertDialog open={!!pendingMoveToFront} onOpenChange={(open) => !open && setPendingMoveToFront(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Front of Queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset {pendingMoveToFront?.last_name}, {pendingMoveToFront?.first_name}'s
              queue position. This action is recorded and may be subject to grievance review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPendingMoveToFront(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmMoveToFront}>Move to Front</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjust hours dialog */}
      <Dialog open={!!adjustTarget} onOpenChange={(open) => !open && setAdjustTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust OT Hours</DialogTitle>
            <DialogDescription>
              Manually adjust OT hours for{' '}
              <strong>
                {adjustTarget?.last_name}, {adjustTarget?.first_name}
              </strong>{' '}
              — FY {adjustTarget?.fiscal_year}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Hours Worked Delta" htmlFor="adj-worked">
              <Input
                id="adj-worked"
                type="number"
                step="0.5"
                value={adjustWorked}
                onChange={(e) => setAdjustWorked(e.target.value)}
                placeholder="e.g. 4.0 or -2.0"
              />
            </FormField>
            <FormField label="Hours Declined Delta" htmlFor="adj-declined">
              <Input
                id="adj-declined"
                type="number"
                step="0.5"
                value={adjustDeclined}
                onChange={(e) => setAdjustDeclined(e.target.value)}
                placeholder="e.g. 4.0 or -2.0"
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustSubmit} disabled={adjustMut.isPending}>
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
