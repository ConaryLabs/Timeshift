import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FormField } from '@/components/ui/form-field'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useHolidays, useCreateHoliday, useUpdateHoliday, useDeleteHoliday } from '@/hooks/queries'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import type { Holiday } from '@/api/holidays'

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  name: z.string().min(1, 'Name is required'),
  is_premium_pay: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i)

export default function HolidayCalendarPage() {
  const [year, setYear] = useState(currentYear)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Holiday | null>(null)

  const { data: holidays, isLoading, isError } = useHolidays(year)
  const createMut = useCreateHoliday()
  const updateMut = useUpdateHoliday()
  const deleteMut = useDeleteHoliday()

  const { confirmClose, confirmDialog } = useConfirmClose()

  const { register, handleSubmit, reset, formState: { errors, isDirty }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const isPremiumPay = watch('is_premium_pay')

  function openCreate() {
    setEditingItem(null)
    reset({ date: '', name: '', is_premium_pay: false })
    setDialogOpen(true)
  }

  function openEdit(item: Holiday) {
    setEditingItem(item)
    reset({
      date: item.date,
      name: item.name,
      is_premium_pay: item.is_premium_pay,
    })
    setDialogOpen(true)
  }

  function onSubmit(values: FormValues) {
    if (editingItem) {
      updateMut.mutate(
        { id: editingItem.id, name: values.name, is_premium_pay: values.is_premium_pay },
        {
          onSuccess: () => {
            toast.success('Holiday updated')
            setDialogOpen(false)
          },
        },
      )
    } else {
      createMut.mutate(
        { date: values.date, name: values.name, is_premium_pay: values.is_premium_pay },
        {
          onSuccess: () => {
            toast.success('Holiday created')
            setDialogOpen(false)
          },
        },
      )
    }
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this holiday?')) return
    deleteMut.mutate(id, {
      onSuccess: () => toast.success('Holiday deleted'),
    })
  }

  const columns: Column<Holiday>[] = [
    {
      header: 'Date',
      cell: (r) => new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    },
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Premium Pay',
      cell: (r) =>
        r.is_premium_pay ? (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
            <Star className="h-3 w-3 mr-1" /> Premium
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">No</span>
        ),
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
            className="text-destructive hover:text-destructive"
            onClick={() => handleDelete(r.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Holiday Calendar"
        description="Manage holiday dates for your organization"
        actions={
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate}>+ Add Holiday</Button>
          </div>
        }
      />

      {isError ? (
        <p className="text-sm text-destructive">Failed to load holidays.</p>
      ) : (
        <DataTable
          columns={columns}
          data={holidays ?? []}
          isLoading={isLoading}
          emptyMessage="No holidays for this year"
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) confirmClose(isDirty, () => setDialogOpen(false)) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Holiday' : 'New Holiday'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!editingItem && (
              <FormField label="Date" htmlFor="holiday-date" required error={errors.date?.message}>
                <Input id="holiday-date" type="date" {...register('date')} />
              </FormField>
            )}
            <FormField label="Name" htmlFor="holiday-name" required error={errors.name?.message}>
              <Input id="holiday-name" {...register('name')} />
            </FormField>
            <div className="flex items-center gap-2">
              <Switch
                id="holiday-premium"
                checked={isPremiumPay}
                onCheckedChange={(v) => setValue('is_premium_pay', v, { shouldDirty: true })}
              />
              <Label htmlFor="holiday-premium">Premium Pay</Label>
            </div>
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
