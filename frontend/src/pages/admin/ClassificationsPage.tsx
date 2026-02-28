/* eslint-disable react-hooks/incompatible-library */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState } from '@/components/ui/error-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useClassifications, useCreateClassification, useUpdateClassification } from '@/hooks/queries'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import type { Classification } from '@/api/classifications'
import { extractApiError } from '@/lib/format'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  abbreviation: z.string().min(1, 'Abbreviation is required'),
  display_order: z.number().int().min(0),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export default function ClassificationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Classification | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const { data: classifications, isLoading, isError } = useClassifications(
    showInactive ? { include_inactive: true } : undefined,
  )
  const createMut = useCreateClassification()
  const updateMut = useUpdateClassification()

  const { confirmClose, confirmDialog } = useConfirmClose()

  const { register, handleSubmit, reset, formState: { errors, isDirty }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const isActive = watch('is_active')

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', abbreviation: '', display_order: 0, is_active: true })
    setDialogOpen(true)
  }

  function openEdit(item: Classification) {
    setEditingItem(item)
    reset({
      name: item.name,
      abbreviation: item.abbreviation,
      display_order: item.display_order,
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  function onSubmit(values: FormValues) {
    if (editingItem) {
      updateMut.mutate(
        { id: editingItem.id, ...values },
        {
          onSuccess: () => {
            toast.success('Classification updated')
            setDialogOpen(false)
          },
          onError: (err: unknown) => {
            const msg = extractApiError(err, 'Failed to update classification')
            toast.error(msg)
          },
        },
      )
    } else {
      createMut.mutate(
        { name: values.name, abbreviation: values.abbreviation, display_order: values.display_order },
        {
          onSuccess: () => {
            toast.success('Classification created')
            setDialogOpen(false)
          },
          onError: (err: unknown) => {
            const msg = extractApiError(err, 'Failed to create classification')
            toast.error(msg)
          },
        },
      )
    }
  }

  const columns: Column<Classification>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Abbreviation', accessorKey: 'abbreviation' },
    { header: 'Order', accessorKey: 'display_order', className: 'w-20' },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.is_active ? 'active' : 'inactive'} />,
    },
    {
      header: 'Actions',
      cell: (r) => (
        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Classifications"
        description="Job classifications for your organization"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm">Show inactive</Label>
            </div>
            <Button onClick={openCreate}>+ Add Classification</Button>
          </div>
        }
      />

      {isError ? (
        <ErrorState message="Failed to load classifications." />
      ) : (
        <DataTable
          columns={columns}
          data={classifications ?? []}
          isLoading={isLoading}
          emptyMessage="No classifications"
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) confirmClose(isDirty, () => setDialogOpen(false)) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Classification' : 'New Classification'}</DialogTitle>
            <DialogDescription>Create or edit classification details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Name" htmlFor="cls-name" required error={errors.name?.message}>
              <Input id="cls-name" {...register('name')} />
            </FormField>
            <FormField label="Abbreviation" htmlFor="cls-abbr" required error={errors.abbreviation?.message}>
              <Input id="cls-abbr" {...register('abbreviation')} />
            </FormField>
            <FormField label="Display Order" htmlFor="cls-order" error={errors.display_order?.message}>
              <Input id="cls-order" type="number" {...register('display_order', { valueAsNumber: true })} />
            </FormField>
            {editingItem && (
              <div className="flex items-center gap-2">
                <Switch
                  id="cls-active"
                  checked={isActive}
                  onCheckedChange={(v) => setValue('is_active', v)}
                />
                <Label htmlFor="cls-active">Active</Label>
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
    </div>
  )
}
