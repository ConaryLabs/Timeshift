import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { useSchedulePeriods, useCreatePeriod } from '@/hooks/queries'
import type { SchedulePeriod } from '@/api/schedulePeriods'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
}).refine((v) => v.end_date > v.start_date, {
  message: 'End date must be after start date',
  path: ['end_date'],
})

type FormValues = z.infer<typeof schema>

export default function SchedulePeriodsPage() {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: periods, isLoading, isError } = useSchedulePeriods()
  const createMut = useCreatePeriod()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function openCreate() {
    reset({ name: '', start_date: '', end_date: '' })
    setDialogOpen(true)
  }

  function onSubmit(values: FormValues) {
    createMut.mutate(values, {
      onSuccess: () => {
        toast.success('Schedule period created')
        setDialogOpen(false)
      },
    })
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  }

  const columns: Column<SchedulePeriod>[] = [
    { header: 'Name', accessorKey: 'name' },
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
