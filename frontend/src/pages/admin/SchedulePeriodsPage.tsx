import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { useSchedulePeriods, useCreatePeriod, useBargainingUnits } from '@/hooks/queries'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import type { SchedulePeriod } from '@/api/schedulePeriods'
import { extractApiError } from '@/lib/format'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  bargaining_unit: z.string().optional(),
}).refine((v) => v.end_date > v.start_date, {
  message: 'End date must be after start date',
  path: ['end_date'],
})

type FormValues = z.infer<typeof schema>

function bargainingUnitLabel(bu: string | null, bargainingUnits: { code: string; name: string }[]): string | null {
  if (!bu) return null
  const found = bargainingUnits.find((o) => o.code === bu)
  return found ? found.name : bu.toUpperCase()
}

export default function SchedulePeriodsPage() {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: periods, isLoading, isError } = useSchedulePeriods()
  const { data: bargainingUnits = [] } = useBargainingUnits()
  const createMut = useCreatePeriod()

  const { confirmClose, confirmDialog } = useConfirmClose()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function openCreate() {
    reset({ name: '', start_date: '', end_date: '', bargaining_unit: '' })
    setDialogOpen(true)
  }

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      bargaining_unit: values.bargaining_unit || null,
    }
    createMut.mutate(payload, {
      onSuccess: () => {
        toast.success('Schedule period created')
        setDialogOpen(false)
      },
      onError: (err: unknown) => {
        const msg = extractApiError(err, 'Operation failed')
        toast.error(msg)
      },
    })
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  }

  const columns: Column<SchedulePeriod>[] = [
    {
      header: 'Name',
      cell: (r) => (
        <span className="flex items-center gap-2">
          {r.name}
          {r.bargaining_unit && (
            <Badge variant="outline" className="text-xs">{bargainingUnitLabel(r.bargaining_unit, bargainingUnits)}</Badge>
          )}
        </span>
      ),
    },
    {
      header: 'Date Range',
      cell: (r) => `${formatDate(r.start_date)} – ${formatDate(r.end_date)}`,
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.is_active ? 'active' : 'inactive'} />,
    },
    {
      header: 'Actions',
      cell: (r) => (
        <Button size="sm" variant="outline" onClick={() => navigate(`/admin/schedule-periods/${r.id}`)}>
          Manage Assignments
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Schedule Periods"
        description="Bid periods for assigning users to shift slots"
        actions={<Button onClick={openCreate}>+ Add Period</Button>}
      />

      {isError ? (
        <p className="text-sm text-destructive">Failed to load schedule periods.</p>
      ) : (
        <DataTable
          columns={columns}
          data={periods ?? []}
          isLoading={isLoading}
          emptyMessage="No schedule periods"
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) confirmClose(isDirty, () => setDialogOpen(false)) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Schedule Period</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Name" htmlFor="sp-name" required error={errors.name?.message}>
              <Input id="sp-name" {...register('name')} placeholder="e.g. 2026 A Shift Bid" />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date" htmlFor="sp-start" required error={errors.start_date?.message}>
                <Input id="sp-start" type="date" {...register('start_date')} />
              </FormField>
              <FormField label="End Date" htmlFor="sp-end" required error={errors.end_date?.message}>
                <Input id="sp-end" type="date" {...register('end_date')} />
              </FormField>
            </div>
            <FormField label="Bargaining Unit" htmlFor="sp-bu">
              <Select
                value={watch('bargaining_unit') || '__all'}
                onValueChange={(v) => setValue('bargaining_unit', v === '__all' ? '' : v, { shouldDirty: true })}
              >
                <SelectTrigger id="sp-bu">
                  <SelectValue placeholder="(All employees)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">(All employees)</SelectItem>
                  {bargainingUnits.map((bu) => (
                    <SelectItem key={bu.code} value={bu.code}>
                      {bu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  )
}
