// frontend/src/pages/admin/DutyPositionsPage.tsx
/* eslint-disable react-hooks/incompatible-library */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState } from '@/components/ui/error-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useDutyPositions,
  useCreateDutyPosition,
  useUpdateDutyPosition,
  useDeleteDutyPosition,
  useClassifications,
} from '@/hooks/queries'
import { useQualifications, usePositionQualifications, useAddPositionQualification, useRemovePositionQualification } from '@/hooks/useDutyBoard'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import { mutationCallbacks } from '@/hooks/mutationCallbacks'
import type { DutyPosition } from '@/api/dutyPositions'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  classification_id: z.string().optional(),
  sort_order: z.number().int().min(0),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function QualificationsDialog({ position, open, onOpenChange }: {
  position: DutyPosition | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: allQuals } = useQualifications()
  const { data: posQuals } = usePositionQualifications(position?.id ?? '')
  const addMut = useAddPositionQualification()
  const removeMut = useRemovePositionQualification()

  if (!position) return null

  const posQualIds = new Set(posQuals?.map((q) => q.id) ?? [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Qualifications for {position.name}</DialogTitle>
          <DialogDescription>
            Select which qualifications are required to be assigned to this position.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {allQuals?.map((q) => (
            <div key={q.id} className="flex items-center justify-between py-1">
              <div>
                <div className="text-sm font-medium">{q.name}</div>
                {q.description && <div className="text-xs text-muted-foreground">{q.description}</div>}
              </div>
              <Switch
                checked={posQualIds.has(q.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    addMut.mutate({ positionId: position.id, qualificationId: q.id })
                  } else {
                    removeMut.mutate({ positionId: position.id, qualificationId: q.id })
                  }
                }}
              />
            </div>
          )) ?? <p className="text-sm text-muted-foreground">No qualifications defined. Create them first.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DutyPositionsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DutyPosition | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DutyPosition | null>(null)
  const [qualTarget, setQualTarget] = useState<DutyPosition | null>(null)

  const { data: positions, isLoading, isError } = useDutyPositions()
  const { data: classifications } = useClassifications()
  const createMut = useCreateDutyPosition()
  const updateMut = useUpdateDutyPosition()
  const deleteMut = useDeleteDutyPosition()

  const { confirmClose, confirmDialog } = useConfirmClose()

  const { register, handleSubmit, reset, formState: { errors, isDirty }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const isActive = watch('is_active')
  const classificationId = watch('classification_id')

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', classification_id: undefined, sort_order: 0, is_active: true })
    setDialogOpen(true)
  }

  function openEdit(item: DutyPosition) {
    setEditingItem(item)
    reset({
      name: item.name,
      classification_id: item.classification_id ?? undefined,
      sort_order: item.sort_order,
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  function onSubmit(values: FormValues) {
    const classId = values.classification_id || undefined
    if (editingItem) {
      updateMut.mutate(
        { id: editingItem.id, name: values.name, classification_id: classId ?? null, sort_order: values.sort_order, is_active: values.is_active },
        mutationCallbacks('Duty position updated', () => setDialogOpen(false), 'Failed to update duty position'),
      )
    } else {
      createMut.mutate(
        { name: values.name, classification_id: classId, sort_order: values.sort_order },
        mutationCallbacks('Duty position created', () => setDialogOpen(false), 'Failed to create duty position'),
      )
    }
  }

  function classificationName(id: string | null): string {
    if (!id || !classifications) return '-'
    return classifications.find((c) => c.id === id)?.name ?? '-'
  }

  const columns: Column<DutyPosition>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Classification',
      cell: (r) => classificationName(r.classification_id),
    },
    { header: 'Sort Order', accessorKey: 'sort_order', className: 'w-24' },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.is_active ? 'active' : 'inactive'} />,
    },
    {
      header: 'Actions',
      cell: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => setQualTarget(r)}>
            Quals
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteTarget(r)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Duty Positions"
        description="Define positions that need to be filled on each shift (e.g., Radio 1, Call Taker 1)"
        actions={<Button onClick={openCreate}>+ Add Position</Button>}
      />

      {isError ? (
        <ErrorState message="Failed to load duty positions." />
      ) : (
        <DataTable
          columns={columns}
          data={positions ?? []}
          isLoading={isLoading}
          emptyMessage="No duty positions"
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) confirmClose(isDirty, () => setDialogOpen(false)) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Duty Position' : 'New Duty Position'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Name" htmlFor="dp-name" required error={errors.name?.message}>
              <Input id="dp-name" {...register('name')} placeholder="e.g., Radio 1" />
            </FormField>
            <FormField label="Classification" htmlFor="dp-class">
              <Select
                value={classificationId ?? ''}
                onValueChange={(v) => setValue('classification_id', v === '__none__' ? undefined : v, { shouldDirty: true })}
              >
                <SelectTrigger id="dp-class">
                  <SelectValue placeholder="Any classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Any classification</SelectItem>
                  {classifications?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Sort Order" htmlFor="dp-sort" error={errors.sort_order?.message}>
              <Input id="dp-sort" type="number" {...register('sort_order', { valueAsNumber: true })} />
            </FormField>
            {editingItem && (
              <div className="flex items-center gap-2">
                <Switch
                  id="dp-active"
                  checked={isActive}
                  onCheckedChange={(v) => setValue('is_active', v)}
                />
                <Label htmlFor="dp-active">Active</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editingItem ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {confirmDialog}

      <QualificationsDialog position={qualTarget} open={!!qualTarget} onOpenChange={(open) => !open && setQualTarget(null)} />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Duty Position</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              It will be deactivated and no longer available for assignment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return
                deleteMut.mutate(
                  deleteTarget.id,
                  mutationCallbacks('Duty position deleted', () => setDeleteTarget(null), 'Failed to delete duty position'),
                )
              }}
              disabled={deleteMut.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
