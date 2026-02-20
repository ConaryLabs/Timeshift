import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
import {
  useTeam,
  useTeamSlots,
  useCreateSlot,
  useUpdateSlot,
  useShiftTemplates,
  useClassifications,
} from '@/hooks/queries'
import type { ShiftSlotView } from '@/api/teams'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const schema = z.object({
  shift_template_id: z.string().min(1, 'Shift template is required'),
  classification_id: z.string().min(1, 'Classification is required'),
  days_of_week: z.array(z.number()).min(1, 'Select at least one day'),
  label: z.string().optional(),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function formatTime(time: string) {
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${m} ${ampm}`
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ShiftSlotView | null>(null)

  const { data: team, isLoading: teamLoading } = useTeam(id!)
  const { data: slots, isLoading: slotsLoading } = useTeamSlots(id!)
  const { data: templates } = useShiftTemplates()
  const { data: classifications } = useClassifications()
  const createMut = useCreateSlot()
  const updateMut = useUpdateSlot()

  const { handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const selectedDays = watch('days_of_week') ?? []
  const templateId = watch('shift_template_id')
  const classificationId = watch('classification_id')
  const isActive = watch('is_active')

  function openCreate() {
    setEditingItem(null)
    reset({ shift_template_id: '', classification_id: '', days_of_week: [], label: '', is_active: true })
    setDialogOpen(true)
  }

  function openEdit(item: ShiftSlotView) {
    setEditingItem(item)
    reset({
      shift_template_id: item.shift_template_id,
      classification_id: item.classification_id,
      days_of_week: item.days_of_week,
      label: item.label ?? '',
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  function toggleDay(day: number) {
    const current = selectedDays
    if (current.includes(day)) {
      setValue('days_of_week', current.filter((d) => d !== day), { shouldValidate: true })
    } else {
      setValue('days_of_week', [...current, day].sort(), { shouldValidate: true })
    }
  }

  function onSubmit(values: FormValues) {
    if (editingItem) {
      updateMut.mutate(
        {
          slotId: editingItem.id,
          shift_template_id: values.shift_template_id,
          classification_id: values.classification_id,
          days_of_week: values.days_of_week,
          label: values.label || undefined,
          is_active: values.is_active,
        },
        {
          onSuccess: () => {
            toast.success('Slot updated')
            setDialogOpen(false)
          },
        },
      )
    } else {
      createMut.mutate(
        {
          teamId: id!,
          shift_template_id: values.shift_template_id,
          classification_id: values.classification_id,
          days_of_week: values.days_of_week,
          label: values.label || undefined,
        },
        {
          onSuccess: () => {
            toast.success('Slot created')
            setDialogOpen(false)
          },
        },
      )
    }
  }

  if (teamLoading) return <LoadingState />

  const columns: Column<ShiftSlotView>[] = [
    { header: 'Shift', accessorKey: 'shift_template_name' },
    {
      header: 'Time Range',
      cell: (r) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}`,
    },
    { header: 'Classification', accessorKey: 'classification_abbreviation' },
    {
      header: 'Days',
      cell: (r) => (
        <div className="flex gap-1">
          {r.days_of_week.map((d) => (
            <span
              key={d}
              className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium w-8 h-6"
            >
              {DAY_LABELS[d]}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: 'Label',
      cell: (r) => r.label ?? <span className="text-muted-foreground">—</span>,
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
      <Link
        to="/admin/teams"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Teams
      </Link>

      <PageHeader
        title={team?.name ?? 'Team'}
        description={team?.is_active === false ? 'This team is inactive' : undefined}
        actions={<Button onClick={openCreate}>+ Add Slot</Button>}
      />

      <DataTable
        columns={columns}
        data={slots ?? []}
        isLoading={slotsLoading}
        emptyMessage="No shift slots"
        rowKey={(r) => r.id}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Slot' : 'New Slot'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Shift Template" htmlFor="slot-tmpl" required error={errors.shift_template_id?.message}>
              <Select value={templateId} onValueChange={(v) => setValue('shift_template_id', v)}>
                <SelectTrigger id="slot-tmpl">
                  <SelectValue placeholder="Select shift…" />
                </SelectTrigger>
                <SelectContent>
                  {(templates ?? []).filter((t) => t.is_active).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Classification" htmlFor="slot-cls" required error={errors.classification_id?.message}>
              <Select value={classificationId} onValueChange={(v) => setValue('classification_id', v)}>
                <SelectTrigger id="slot-cls">
                  <SelectValue placeholder="Select classification…" />
                </SelectTrigger>
                <SelectContent>
                  {(classifications ?? []).filter((c) => c.is_active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Days of Week" error={errors.days_of_week?.message} required>
              <div className="flex gap-1">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      selectedDays.includes(i)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-input hover:bg-accent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Label" htmlFor="slot-label">
              <Input
                id="slot-label"
                value={watch('label') ?? ''}
                onChange={(e) => setValue('label', e.target.value)}
                placeholder="Optional label"
              />
            </FormField>
            {editingItem && (
              <div className="flex items-center gap-2">
                <Switch
                  id="slot-active"
                  checked={isActive}
                  onCheckedChange={(v) => setValue('is_active', v)}
                />
                <Label htmlFor="slot-active">Active</Label>
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
    </div>
  )
}
