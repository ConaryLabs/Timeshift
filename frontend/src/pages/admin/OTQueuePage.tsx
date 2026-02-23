import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowUp, ArrowDown } from 'lucide-react'
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
import { PageHeader } from '@/components/ui/page-header'
import { FormField } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  useClassifications,
  useOtQueue,
  useReorderOtQueue,
  useOtHours,
  useAdjustOtHours,
} from '@/hooks/queries'
import { NO_VALUE } from '@/lib/format'
import type { OtQueueEntry, OtHoursEntry } from '@/api/ot'

const currentYear = new Date().getFullYear()
const FISCAL_YEARS = [currentYear - 1, currentYear, currentYear + 1]

export default function OTQueuePage() {
  const [selectedClassification, setSelectedClassification] = useState(NO_VALUE)
  const [fiscalYear, setFiscalYear] = useState(currentYear)
  const [localQueue, setLocalQueue] = useState<OtQueueEntry[] | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<OtHoursEntry | null>(null)
  const [adjustWorked, setAdjustWorked] = useState('')
  const [adjustDeclined, setAdjustDeclined] = useState('')

  const { data: classifications } = useClassifications()
  const classId = selectedClassification !== NO_VALUE ? selectedClassification : ''
  const { data: queueData, isLoading: queueLoading } = useOtQueue(classId, fiscalYear)
  const reorderMut = useReorderOtQueue()
  const { data: hoursData, isLoading: hoursLoading } = useOtHours({ fiscal_year: fiscalYear })
  const adjustMut = useAdjustOtHours()

  // Use local ordering state if user has rearranged, otherwise use fetched data
  const queue = localQueue ?? queueData ?? []

  function moveItem(index: number, direction: 'up' | 'down') {
    const items = [...queue]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= items.length) return
    ;[items[index], items[targetIndex]] = [items[targetIndex], items[index]]
    // Update positions
    const reordered = items.map((item, i) => ({ ...item, position: i + 1 }))
    setLocalQueue(reordered)
  }

  function handleSaveOrder() {
    if (!localQueue || !classId) return
    reorderMut.mutate(
      {
        classification_id: classId,
        fiscal_year: fiscalYear,
        user_ids: localQueue.map((q) => q.user_id),
      },
      {
        onSuccess: () => {
          toast.success('Queue order saved')
          setLocalQueue(null)
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
      },
    )
  }

  // Reset local queue when classification or fiscal year changes
  function handleClassificationChange(value: string) {
    setSelectedClassification(value)
    setLocalQueue(null)
  }

  function handleFiscalYearChange(value: string) {
    setFiscalYear(parseInt(value, 10))
    setLocalQueue(null)
  }

  const queueColumns: Column<OtQueueEntry>[] = [
    {
      header: '#',
      cell: (r) => <span className="font-semibold text-muted-foreground">{r.position}</span>,
      className: 'w-12',
    },
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
      header: 'Reorder',
      cell: (r) => {
        const idx = queue.findIndex((q) => q.user_id === r.user_id)
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={idx === 0}
              onClick={() => moveItem(idx, 'up')}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={idx === queue.length - 1}
              onClick={() => moveItem(idx, 'down')}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )
      },
      className: 'w-24',
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">Queue Order</h3>
            {localQueue && (
              <Button size="sm" onClick={handleSaveOrder} disabled={reorderMut.isPending}>
                Save Order
              </Button>
            )}
          </div>

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
