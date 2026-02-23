import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FormField } from '@/components/ui/form-field'
import {
  useCoverageRequirements,
  useCreateCoverageRequirement,
  useUpdateCoverageRequirement,
  useDeleteCoverageRequirement,
  useShiftTemplates,
  useClassifications,
} from '@/hooks/queries'
import { NO_VALUE } from '@/lib/format'
import type { CoverageRequirement } from '@/api/coverage'

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CoverageRequirementsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CoverageRequirement | null>(null)

  // Form state
  const [shiftTemplateId, setShiftTemplateId] = useState('')
  const [classificationId, setClassificationId] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [minHeadcount, setMinHeadcount] = useState(1)
  const [targetHeadcount, setTargetHeadcount] = useState(1)
  const [maxHeadcount, setMaxHeadcount] = useState(1)

  // Filter state
  const [filterShift, setFilterShift] = useState<string | undefined>()
  const [filterClassification, setFilterClassification] = useState<string | undefined>()

  const { data: requirements, isLoading, isError } = useCoverageRequirements({
    shift_template_id: filterShift,
    classification_id: filterClassification,
  })
  const { data: templates } = useShiftTemplates()
  const { data: classifications } = useClassifications()
  const createMut = useCreateCoverageRequirement()
  const updateMut = useUpdateCoverageRequirement()
  const deleteMut = useDeleteCoverageRequirement()

  const activeTemplates = (templates ?? []).filter((t) => t.is_active)
  const activeClassifications = (classifications ?? []).filter((c) => c.is_active)

  function templateName(id: string) {
    return templates?.find((t) => t.id === id)?.name ?? '—'
  }

  function classificationName(id: string) {
    return classifications?.find((c) => c.id === id)?.abbreviation ?? '—'
  }

  function openCreate() {
    setEditingItem(null)
    setShiftTemplateId('')
    setClassificationId('')
    setDayOfWeek(0)
    setMinHeadcount(1)
    setTargetHeadcount(1)
    setMaxHeadcount(1)
    setDialogOpen(true)
  }

  function openEdit(item: CoverageRequirement) {
    setEditingItem(item)
    setShiftTemplateId(item.shift_template_id)
    setClassificationId(item.classification_id)
    setDayOfWeek(item.day_of_week)
    setMinHeadcount(item.min_headcount)
    setTargetHeadcount(item.target_headcount)
    setMaxHeadcount(item.max_headcount)
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (editingItem) {
      updateMut.mutate(
        {
          id: editingItem.id,
          min_headcount: minHeadcount,
          target_headcount: targetHeadcount,
          max_headcount: maxHeadcount,
        },
        {
          onSuccess: () => {
            toast.success('Coverage requirement updated')
            setDialogOpen(false)
          },
        },
      )
    } else {
      if (!shiftTemplateId || !classificationId) {
        toast.error('Please select a shift template and classification')
        return
      }
      createMut.mutate(
        {
          shift_template_id: shiftTemplateId,
          classification_id: classificationId,
          day_of_week: dayOfWeek,
          min_headcount: minHeadcount,
          target_headcount: targetHeadcount,
          max_headcount: maxHeadcount,
        },
        {
          onSuccess: () => {
            toast.success('Coverage requirement created')
            setDialogOpen(false)
          },
        },
      )
    }
  }

  function handleDelete(id: string) {
    deleteMut.mutate(id, {
      onSuccess: () => toast.success('Deleted'),
    })
  }

  const columns: Column<CoverageRequirement>[] = [
    {
      header: 'Shift',
      cell: (r) => templateName(r.shift_template_id),
    },
    {
      header: 'Classification',
      cell: (r) => classificationName(r.classification_id),
    },
    {
      header: 'Day',
      cell: (r) => SHORT_DAY_LABELS[r.day_of_week] ?? '?',
      className: 'w-20',
    },
    {
      header: 'Min',
      accessorKey: 'min_headcount',
      className: 'w-16 text-center',
    },
    {
      header: 'Target',
      accessorKey: 'target_headcount',
      className: 'w-16 text-center',
    },
    {
      header: 'Max',
      accessorKey: 'max_headcount',
      className: 'w-16 text-center',
    },
    {
      header: 'Actions',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => handleDelete(r.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Coverage Requirements"
        description="Set minimum/target/maximum headcount per shift, classification, and day of week"
        actions={<Button onClick={openCreate}>+ Add Requirement</Button>}
      />

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <Select
          value={filterShift ?? NO_VALUE}
          onValueChange={(v) => setFilterShift(v === NO_VALUE ? undefined : v)}
        >
          <SelectTrigger className="w-[180px] h-8 text-sm">
            <SelectValue placeholder="All Shifts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_VALUE}>All Shifts</SelectItem>
            {activeTemplates.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterClassification ?? NO_VALUE}
          onValueChange={(v) => setFilterClassification(v === NO_VALUE ? undefined : v)}
        >
          <SelectTrigger className="w-[180px] h-8 text-sm">
            <SelectValue placeholder="All Classifications" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_VALUE}>All Classifications</SelectItem>
            {activeClassifications.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load coverage requirements.</p>
      ) : (
        <DataTable
          columns={columns}
          data={requirements ?? []}
          isLoading={isLoading}
          emptyMessage="No coverage requirements configured"
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Coverage Requirement' : 'New Coverage Requirement'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingItem && (
              <>
                <FormField label="Shift Template" htmlFor="cov-shift" required>
                  <Select value={shiftTemplateId} onValueChange={setShiftTemplateId}>
                    <SelectTrigger id="cov-shift">
                      <SelectValue placeholder="Select shift..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Classification" htmlFor="cov-class" required>
                  <Select value={classificationId} onValueChange={setClassificationId}>
                    <SelectTrigger id="cov-class">
                      <SelectValue placeholder="Select classification..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeClassifications.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Day of Week" htmlFor="cov-dow" required>
                  <Select
                    value={String(dayOfWeek)}
                    onValueChange={(v) => setDayOfWeek(Number(v))}
                  >
                    <SelectTrigger id="cov-dow">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_LABELS.map((label, i) => (
                        <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </>
            )}

            <div className="grid grid-cols-3 gap-3">
              <FormField label="Min" htmlFor="cov-min" required>
                <Input
                  id="cov-min"
                  type="number"
                  min={0}
                  value={minHeadcount}
                  onChange={(e) => setMinHeadcount(Number(e.target.value))}
                />
              </FormField>
              <FormField label="Target" htmlFor="cov-target" required>
                <Input
                  id="cov-target"
                  type="number"
                  min={0}
                  value={targetHeadcount}
                  onChange={(e) => setTargetHeadcount(Number(e.target.value))}
                />
              </FormField>
              <FormField label="Max" htmlFor="cov-max" required>
                <Input
                  id="cov-max"
                  type="number"
                  min={0}
                  value={maxHeadcount}
                  onChange={(e) => setMaxHeadcount(Number(e.target.value))}
                />
              </FormField>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editingItem ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
