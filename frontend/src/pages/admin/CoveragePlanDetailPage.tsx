import { useState, useEffect, useCallback, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useCoveragePlan,
  useCoveragePlanSlots,
  useBulkUpsertSlots,
  useClassifications,
} from '@/hooks/queries'
import type { SlotEntry } from '@/api/coveragePlans'
import { extractApiError } from '@/lib/format'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const NUM_SLOTS = 48

function slotLabel(idx: number): string {
  const totalMin = idx * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

type SlotValues = { min: number; target: number; max: number }
type GridState = SlotValues[][] // [dow 0-6][slot 0-47]
type EditField = 'min' | 'target' | 'max'

function emptyGrid(): GridState {
  return Array.from({ length: 7 }, () =>
    Array.from({ length: NUM_SLOTS }, () => ({ min: 0, target: 0, max: 0 })),
  )
}

const SlotCell = memo(function SlotCell({
  values,
  onChange,
}: {
  values: SlotValues
  onChange: (field: EditField, value: number) => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      {(['min', 'target', 'max'] as EditField[]).map((field) => (
        <input
          key={field}
          type="number"
          min={0}
          max={99}
          value={values[field]}
          onChange={(e) => onChange(field, Math.max(0, Number(e.target.value) || 0))}
          className={cn(
            'w-7 text-center text-xs rounded border bg-background py-0.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            field === 'target' && 'font-semibold',
          )}
          title={field}
        />
      ))}
    </div>
  )
})

export default function CoveragePlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const planId = id ?? ''

  const { data: plan, isLoading: planLoading } = useCoveragePlan(planId)
  const { data: classifications } = useClassifications()
  const activeClassifications = (classifications ?? []).filter((c: { is_active: boolean }) => c.is_active)

  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const classId = selectedClassId || activeClassifications[0]?.id || ''

  const { data: slots, isLoading: slotsLoading } = useCoveragePlanSlots(planId)
  const bulkUpsert = useBulkUpsertSlots()

  const [gridState, setGridState] = useState<GridState>(emptyGrid())
  const [isDirty, setIsDirty] = useState(false)
  const [pendingClassSwitch, setPendingClassSwitch] = useState<string | null>(null)

  // Populate grid when slots or classification changes
  useEffect(() => {
    const next = emptyGrid()
    if (slots && classId) {
      for (const s of slots) {
        if (s.classification_id === classId) {
          next[s.day_of_week][s.slot_index] = {
            min: s.min_headcount,
            target: s.target_headcount,
            max: s.max_headcount,
          }
        }
      }
    }
    setGridState(next)
    setIsDirty(false)
  }, [slots, classId])

  const updateCell = useCallback((dow: number, slotIdx: number, field: EditField, value: number) => {
    setGridState((prev) => {
      const next = prev.map((day) => day.map((s) => ({ ...s })))
      next[dow][slotIdx] = { ...next[dow][slotIdx], [field]: value }
      return next
    })
    setIsDirty(true)
  }, [])

  function handleClassChange(newId: string) {
    if (isDirty) {
      setPendingClassSwitch(newId)
    } else {
      setSelectedClassId(newId)
    }
  }

  function confirmClassSwitch() {
    if (pendingClassSwitch) {
      setSelectedClassId(pendingClassSwitch)
      setPendingClassSwitch(null)
    }
  }

  function handleSave() {
    const slotEntries: SlotEntry[] = []
    for (let dow = 0; dow < 7; dow++) {
      for (let si = 0; si < NUM_SLOTS; si++) {
        const v = gridState[dow][si]
        if (v.target > 0 || v.min > 0 || v.max > 0) {
          slotEntries.push({
            classification_id: classId,
            day_of_week: dow,
            slot_index: si,
            min_headcount: v.min,
            target_headcount: v.target,
            max_headcount: v.max,
          })
        }
      }
    }
    bulkUpsert.mutate(
      { planId, slots: slotEntries },
      {
        onSuccess: () => { toast.success('Slots saved'); setIsDirty(false) },
        onError: (err) => toast.error(extractApiError(err, 'Save failed')),
      },
    )
  }

  if (planLoading || slotsLoading) return <LoadingState />

  return (
    <div>
      <PageHeader
        title={plan?.name ?? 'Coverage Plan'}
        description={plan?.description ?? 'Edit per-half-hour staffing requirements'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/coverage-plans')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button onClick={handleSave} disabled={!isDirty || bulkUpsert.isPending}>
              <Save className="h-4 w-4 mr-1.5" />
              Save Changes
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-medium text-muted-foreground">Classification:</span>
        <Select value={classId} onValueChange={handleClassChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select classification" />
          </SelectTrigger>
          <SelectContent>
            {activeClassifications.map((c: { id: string; name: string; abbreviation: string }) => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.abbreviation})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isDirty && <span className="text-sm text-amber-600 font-medium">Unsaved changes</span>}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 border-r px-2 py-1.5 text-left font-medium w-16">
                Time
              </th>
              {DAY_LABELS.map((day, d) => (
                <th key={d} className="border-r px-1 py-1.5 text-center font-medium min-w-[90px]">
                  {day}
                  <div className="text-[10px] font-normal text-muted-foreground">min / tgt / max</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: NUM_SLOTS }, (_, si) => (
              <tr key={si} className={cn('border-t', si % 2 !== 0 && 'bg-muted/20')}>
                <td className="sticky left-0 z-10 bg-background border-r px-2 py-0.5 font-mono text-muted-foreground">
                  {slotLabel(si)}
                </td>
                {Array.from({ length: 7 }, (_, dow) => (
                  <td key={dow} className="border-r px-1 py-0.5">
                    <SlotCell
                      values={gridState[dow][si]}
                      onChange={(field, val) => updateCell(dow, si, field, val)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!pendingClassSwitch} onOpenChange={(o) => { if (!o) setPendingClassSwitch(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes for the current classification. Switching will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPendingClassSwitch(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmClassSwitch}>Discard & Switch</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
