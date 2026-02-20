import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useShiftTemplates, useCreateTemplate, useUpdateTemplate } from '@/hooks/queries'
import { formatTime, formatDuration } from '@/lib/format'
import type { ShiftTemplate } from '@/api/schedule'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
})

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  is_active: z.boolean(),
})

type CreateValues = z.infer<typeof createSchema>
type EditValues = z.infer<typeof editSchema>

export default function ShiftTemplatesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ShiftTemplate | null>(null)

  const { data: templates, isLoading, isError } = useShiftTemplates()
  const createMut = useCreateTemplate()
  const updateMut = useUpdateTemplate()

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
  })

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })

  function openCreate() {
    setEditingItem(null)
    createForm.reset({ name: '', start_time: '', end_time: '', color: '#3b82f6' })
    setDialogOpen(true)
  }

  function openEdit(item: ShiftTemplate) {
    setEditingItem(item)
    editForm.reset({ name: item.name, color: item.color, is_active: item.is_active })
    setDialogOpen(true)
  }

  function onCreateSubmit(values: CreateValues) {
    createMut.mutate(values, {
      onSuccess: () => {
        toast.success('Shift template created')
        setDialogOpen(false)
      },
    })
  }

  function onEditSubmit(values: EditValues) {
    if (!editingItem) return
    updateMut.mutate(
      { id: editingItem.id, ...values },
      {
        onSuccess: () => {
          toast.success('Shift template updated')
          setDialogOpen(false)
        },
      },
    )
  }

  const editIsActive = editForm.watch('is_active')
  const createColor = createForm.watch('color')
  const editColor = editForm.watch('color')

  const columns: Column<ShiftTemplate>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Time Range',
      cell: (r) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}`,
    },
    {
      header: 'Duration',
      cell: (r) => formatDuration(r.duration_minutes),
    },
    {
      header: 'Color',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border" style={{ backgroundColor: r.color }} />
          <span className="text-xs font-mono text-muted-foreground">{r.color}</span>
        </div>
      ),
    },
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
        title="Shift Templates"
        description="Reusable shift definitions with time ranges and colors"
        actions={<Button onClick={openCreate}>+ Add Template</Button>}
      />

      {isError ? (
        <p className="text-sm text-destructive">Failed to load shift templates.</p>
      ) : (
        <DataTable
          columns={columns}
          data={templates ?? []}
          isLoading={isLoading}
          emptyMessage="No shift templates"
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Shift Template' : 'New Shift Template'}</DialogTitle>
          </DialogHeader>

          {editingItem ? (
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField label="Name" htmlFor="st-name" required error={editForm.formState.errors.name?.message}>
                <Input id="st-name" {...editForm.register('name')} />
              </FormField>
              <p className="text-xs text-muted-foreground">
                Time range ({formatTime(editingItem.start_time)} – {formatTime(editingItem.end_time)}) cannot be changed after creation. Create a new template if different times are needed.
              </p>
              <FormField label="Color" htmlFor="st-color" error={editForm.formState.errors.color?.message}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => editForm.setValue('color', e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    id="st-color"
                    {...editForm.register('color')}
                    className="w-32 font-mono"
                    placeholder="#3b82f6"
                  />
                </div>
              </FormField>
              <div className="flex items-center gap-2">
                <Switch
                  id="st-active"
                  checked={editIsActive}
                  onCheckedChange={(v) => editForm.setValue('is_active', v)}
                />
                <Label htmlFor="st-active">Active</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMut.isPending}>Save Changes</Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField label="Name" htmlFor="st-name" required error={createForm.formState.errors.name?.message}>
                <Input id="st-name" {...createForm.register('name')} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Time" htmlFor="st-start" required error={createForm.formState.errors.start_time?.message}>
                  <Input id="st-start" type="time" {...createForm.register('start_time')} />
                </FormField>
                <FormField label="End Time" htmlFor="st-end" required error={createForm.formState.errors.end_time?.message}>
                  <Input id="st-end" type="time" {...createForm.register('end_time')} />
                </FormField>
              </div>
              <FormField label="Color" htmlFor="st-color-c" error={createForm.formState.errors.color?.message}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={createColor}
                    onChange={(e) => createForm.setValue('color', e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    id="st-color-c"
                    {...createForm.register('color')}
                    className="w-32 font-mono"
                    placeholder="#3b82f6"
                  />
                </div>
              </FormField>
              <DialogFooter>
                <Button type="submit" disabled={createMut.isPending}>Create</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
