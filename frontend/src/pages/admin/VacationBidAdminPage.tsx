/* eslint-disable react-hooks/incompatible-library */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
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
  useBargainingUnits,
  useVacationBidPeriods,
  useVacationBidWindows,
  useCreateVacationBidPeriod,
  useDeleteVacationBidPeriod,
  useOpenVacationBidding,
  useProcessVacationBids,
} from '@/hooks/queries'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import type { VacationBidPeriod, VacationBidWindow } from '@/api/vacationBids'
import { extractApiError, formatDateTime } from '@/lib/format'

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear + i - 1)

const createSchema = z.object({
  year: z.coerce.number().min(2000).max(2100),
  round: z.coerce.number().min(1).max(2),
  allowance_hours: z.coerce.number().positive().optional().or(z.literal('')),
  min_block_hours: z.coerce.number().positive().optional().or(z.literal('')),
  bargaining_unit: z.string().optional(),
})

const openSchema = z.object({
  window_duration_hours: z.coerce.number().min(1, 'Must be at least 1 hour'),
  start_at: z.string().optional(),
})

// Types inferred by zodResolver at runtime

export default function VacationBidAdminPage() {
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [createOpen, setCreateOpen] = useState(false)
  const [openBiddingPeriod, setOpenBiddingPeriod] = useState<VacationBidPeriod | null>(null)
  const [windowsPeriod, setWindowsPeriod] = useState<VacationBidPeriod | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [processConfirm, setProcessConfirm] = useState<string | null>(null)

  const { data: bargainingUnits = [] } = useBargainingUnits()
  const { data: periods, isLoading, isError } = useVacationBidPeriods(selectedYear)
  const { data: windows, isLoading: windowsLoading } = useVacationBidWindows(windowsPeriod?.id ?? '')

  const createMut = useCreateVacationBidPeriod()
  const deleteMut = useDeleteVacationBidPeriod()
  const openMut = useOpenVacationBidding()
  const processMut = useProcessVacationBids()

  const { confirmClose, confirmDialog } = useConfirmClose()

  const createForm = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: { year: currentYear, round: 1, allowance_hours: '' as const, min_block_hours: '' as const, bargaining_unit: '__all__' },
  })

  const openForm = useForm({
    resolver: zodResolver(openSchema),
    defaultValues: { window_duration_hours: 24, start_at: '' },
  })

  function handleCreate(values: z.infer<typeof createSchema>) {
    const payload = {
      year: values.year,
      round: values.round,
      allowance_hours: typeof values.allowance_hours === 'number' ? values.allowance_hours : null,
      min_block_hours: typeof values.min_block_hours === 'number' ? values.min_block_hours : null,
      bargaining_unit: values.bargaining_unit && values.bargaining_unit !== '__all__' ? values.bargaining_unit : null,
    }
    createMut.mutate(payload, {
      onSuccess: () => {
        toast.success('Vacation bid period created')
        setCreateOpen(false)
        createForm.reset()
      },
      onError: (err: unknown) => {
        const msg = extractApiError(err, 'Failed to create period')
        toast.error(msg)
      },
    })
  }

  function handleDelete(id: string) {
    deleteMut.mutate(id, {
      onSuccess: () => {
        toast.success('Period deleted')
        setDeleteConfirm(null)
      },
      onError: () => toast.error('Failed to delete period'),
    })
  }

  function handleOpenBidding(values: { window_duration_hours: number; start_at?: string }) {
    if (!openBiddingPeriod) return
    // datetime-local inputs send "YYYY-MM-DDTHH:MM" (no seconds/timezone).
    // Backend expects RFC3339, so append ":00" seconds and local timezone offset.
    const payload = { ...values }
    if (payload.start_at && !payload.start_at.includes('+') && !payload.start_at.includes('Z')) {
      const d = new Date(payload.start_at)
      payload.start_at = !isNaN(d.getTime()) ? d.toISOString() : undefined
    }
    if (!payload.start_at) delete payload.start_at
    openMut.mutate(
      { id: openBiddingPeriod.id, ...payload },
      {
        onSuccess: () => {
          toast.success('Bidding opened successfully')
          setOpenBiddingPeriod(null)
          openForm.reset()
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to open bidding')
          toast.error(msg)
        },
      },
    )
  }

  function handleProcess(periodId: string) {
    processMut.mutate(periodId, {
      onSuccess: () => {
        toast.success('Bids processed successfully')
        setProcessConfirm(null)
      },
      onError: (err: unknown) => {
        const msg = extractApiError(err, 'Failed to process bids')
        toast.error(msg)
        setProcessConfirm(null)
      },
    })
  }

  const periodColumns: Column<VacationBidPeriod>[] = [
    {
      header: 'Year',
      cell: (r) => r.year,
    },
    {
      header: 'Round',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span>Round {r.round}</span>
          {r.bargaining_unit && (
            <Badge variant="outline" className="text-xs">{r.bargaining_unit}</Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Opens',
      cell: (r) => formatDateTime(r.opens_at),
    },
    {
      header: 'Closes',
      cell: (r) => formatDateTime(r.closes_at),
    },
    {
      header: 'Actions',
      cell: (r) => (
        <div className="flex items-center gap-2">
          {r.status === 'draft' && (
            <>
              <Button size="sm" variant="outline" onClick={() => {
                openForm.reset({ window_duration_hours: 24, start_at: '' })
                setOpenBiddingPeriod(r)
              }}>
                Open Bidding
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(r.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
          {r.status === 'open' && (
            <>
              <Button size="sm" variant="outline" onClick={() => setWindowsPeriod(r)}>
                View Windows
              </Button>
              <Button size="sm" onClick={() => setProcessConfirm(r.id)} disabled={processMut.isPending}>
                Process Bids
              </Button>
            </>
          )}
          {r.status === 'completed' && (
            <Button size="sm" variant="outline" onClick={() => setWindowsPeriod(r)}>
              View Results
            </Button>
          )}
        </div>
      ),
    },
  ]

  const windowColumns: Column<VacationBidWindow>[] = [
    {
      header: 'Rank',
      cell: (r) => r.seniority_rank,
    },
    {
      header: 'Employee',
      cell: (r) => `${r.first_name} ${r.last_name}`,
    },
    {
      header: 'Window Opens',
      cell: (r) => formatDateTime(r.opens_at),
    },
    {
      header: 'Window Closes',
      cell: (r) => formatDateTime(r.closes_at),
    },
    {
      header: 'Status',
      cell: (r) => (
        <StatusBadge
          status={r.submitted_at ? 'submitted' : 'pending'}
        />
      ),
    },
    {
      header: 'Submitted',
      cell: (r) => formatDateTime(r.submitted_at),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Vacation Bids"
        description="Manage seniority-based vacation bidding periods"
        actions={
          <div className="flex items-center gap-3">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => {
              createForm.reset({ year: selectedYear, round: 1, allowance_hours: '', min_block_hours: '', bargaining_unit: '__all__' })
              setCreateOpen(true)
            }}>
              + New Period
            </Button>
          </div>
        }
      />

      {isError ? (
        <p className="text-sm text-destructive">Failed to load vacation bid periods.</p>
      ) : (
        <DataTable
          columns={periodColumns}
          data={periods ?? []}
          isLoading={isLoading}
          emptyMessage="No vacation bid periods for this year"
          rowKey={(r) => r.id}
        />
      )}

      {/* Create Period Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        if (!open) confirmClose(createForm.formState.isDirty, () => setCreateOpen(false))
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Vacation Bid Period</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Year" htmlFor="vbp-year" required error={createForm.formState.errors.year?.message}>
                <Input id="vbp-year" type="number" {...createForm.register('year')} />
              </FormField>
              <FormField label="Round" htmlFor="vbp-round" required error={createForm.formState.errors.round?.message}>
                <Select value={String(createForm.watch('round'))} onValueChange={(v) => createForm.setValue('round', Number(v))}>
                  <SelectTrigger id="vbp-round">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Round 1 (Full Weeks)</SelectItem>
                    <SelectItem value="2">Round 2 (Individual Days)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Bargaining Unit" htmlFor="vbp-bu">
              <Select value={createForm.watch('bargaining_unit')} onValueChange={(v) => createForm.setValue('bargaining_unit', v)}>
                <SelectTrigger id="vbp-bu">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">(All employees)</SelectItem>
                  {bargainingUnits.map((bu) => (
                    <SelectItem key={bu.code} value={bu.code}>{bu.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Hour Allowance (per round)" htmlFor="vbp-allowance">
                <Input id="vbp-allowance" type="number" placeholder="e.g. 120" {...createForm.register('allowance_hours')} />
              </FormField>
              <FormField label="Minimum Block Hours" htmlFor="vbp-minblock">
                <Input id="vbp-minblock" type="number" placeholder="e.g. 40" {...createForm.register('min_block_hours')} />
              </FormField>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Open Bidding Dialog */}
      <Dialog open={!!openBiddingPeriod} onOpenChange={(open) => {
        if (!open) setOpenBiddingPeriod(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Open Bidding - {openBiddingPeriod?.year} Round {openBiddingPeriod?.round}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={openForm.handleSubmit(handleOpenBidding)} className="space-y-4">
            <FormField
              label="Window Duration (hours per employee)"
              htmlFor="vbp-duration"
              required
              error={openForm.formState.errors.window_duration_hours?.message}
            >
              <Input id="vbp-duration" type="number" {...openForm.register('window_duration_hours')} />
            </FormField>
            <FormField label="Start At (optional, defaults to now)" htmlFor="vbp-start">
              <Input id="vbp-start" type="datetime-local" {...openForm.register('start_at')} />
            </FormField>
            <p className="text-xs text-muted-foreground">
              Each employee will receive a bidding window in seniority order, each lasting the specified duration.
            </p>
            <DialogFooter>
              <Button type="submit" disabled={openMut.isPending}>Open Bidding</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Windows Dialog */}
      <Dialog open={!!windowsPeriod} onOpenChange={(open) => {
        if (!open) setWindowsPeriod(null)
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {windowsPeriod?.year} Round {windowsPeriod?.round} - Employee Windows
            </DialogTitle>
          </DialogHeader>
          {windowsLoading ? (
            <LoadingState />
          ) : (
            <DataTable
              columns={windowColumns}
              data={windows ?? []}
              emptyMessage="No windows generated"
              rowKey={(r) => r.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Period?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this vacation bid period. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleteMut.isPending}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Process Bids Confirmation */}
      <AlertDialog open={!!processConfirm} onOpenChange={(open) => { if (!open) setProcessConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Process All Bids?</AlertDialogTitle>
            <AlertDialogDescription>
              This will award vacation slots to all employees based on their seniority and preferences.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setProcessConfirm(null)}>Cancel</Button>
            <Button
              onClick={() => processConfirm && handleProcess(processConfirm)}
              disabled={processMut.isPending}
            >
              {processMut.isPending ? 'Processing...' : 'Process Bids'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {confirmDialog}
    </div>
  )
}
