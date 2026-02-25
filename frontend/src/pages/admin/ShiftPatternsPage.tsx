import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FormField } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  useShiftPatterns,
  useCreateShiftPattern,
  useUpdateShiftPattern,
  useDeleteShiftPattern,
  useTeams,
} from '@/hooks/queries'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import type { ShiftPattern } from '@/api/shiftPatterns'
import { extractApiError } from '@/lib/format'

const simpleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  pattern_days: z.number().min(1, 'Must be at least 1'),
  work_days: z.number().min(0, 'Must be non-negative'),
  off_days: z.number().min(0, 'Must be non-negative'),
  anchor_date: z.string().min(1, 'Anchor date is required'),
  team_id: z.string().optional(),
}).refine((data) => data.work_days + data.off_days === data.pattern_days, {
  message: 'Work days + off days must equal pattern days',
  path: ['pattern_days'],
})

type SimpleFormValues = z.infer<typeof simpleSchema>

function formatPatternBadge(p: ShiftPattern) {
  if (p.work_days_in_cycle && p.work_days_in_cycle.length > 0) {
    // Complex pattern: show work/off summary
    return `${p.work_days}w/${p.off_days}o (${p.pattern_days}d)`
  }
  return `${p.work_days}-on ${p.off_days}-off (${p.pattern_days}d cycle)`
}

export default function ShiftPatternsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ShiftPattern | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [patternMode, setPatternMode] = useState<'simple' | 'complex'>('simple')
  const [complexDays, setComplexDays] = useState('')

  const { data: patterns, isLoading, isError } = useShiftPatterns()
  const { data: teams } = useTeams()
  const createMut = useCreateShiftPattern()
  const updateMut = useUpdateShiftPattern()
  const deleteMut = useDeleteShiftPattern()

  const { confirmClose, confirmDialog } = useConfirmClose()

  const { register, handleSubmit, reset, formState: { errors, isDirty }, setValue, watch } = useForm<SimpleFormValues>({
    resolver: zodResolver(simpleSchema),
  })

  const teamId = watch('team_id')

  function openCreate() {
    setEditingItem(null)
    setPatternMode('simple')
    setComplexDays('')
    reset({ name: '', pattern_days: 6, work_days: 4, off_days: 2, anchor_date: '', team_id: '' })
    setDialogOpen(true)
  }

  function openEdit(item: ShiftPattern) {
    setEditingItem(item)
    if (item.work_days_in_cycle && item.work_days_in_cycle.length > 0) {
      setPatternMode('complex')
      setComplexDays(item.work_days_in_cycle.join(', '))
    } else {
      setPatternMode('simple')
      setComplexDays('')
    }
    reset({
      name: item.name,
      pattern_days: item.pattern_days,
      work_days: item.work_days,
      off_days: item.off_days,
      anchor_date: item.anchor_date,
      team_id: item.team_id ?? '',
    })
    setDialogOpen(true)
  }

  function onSubmit(values: SimpleFormValues) {
    if (patternMode === 'complex') {
      // Parse complex days
      const parsed = complexDays.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
      if (parsed.length === 0) {
        toast.error('Enter at least one work day for complex pattern')
        return
      }
      const patternDays = values.pattern_days
      const invalid = parsed.filter(d => d < 1 || d > patternDays)
      if (invalid.length > 0) {
        toast.error(`Work days must be between 1 and ${patternDays}`)
        return
      }

      const data = {
        name: values.name,
        pattern_days: patternDays,
        work_days: parsed.length,
        off_days: patternDays - parsed.length,
        anchor_date: values.anchor_date,
        team_id: values.team_id || null,
        work_days_in_cycle: parsed,
      }

      if (editingItem) {
        updateMut.mutate({ id: editingItem.id, ...data }, {
          onSuccess: () => { toast.success('Pattern updated'); setDialogOpen(false) },
          onError: (err: unknown) => toast.error(extractApiError(err, 'Operation failed')),
        })
      } else {
        createMut.mutate(data, {
          onSuccess: () => { toast.success('Pattern created'); setDialogOpen(false) },
          onError: (err: unknown) => toast.error(extractApiError(err, 'Operation failed')),
        })
      }
      return
    }

    // Simple mode
    const data = {
      name: values.name,
      pattern_days: values.pattern_days,
      work_days: values.work_days,
      off_days: values.off_days,
      anchor_date: values.anchor_date,
      team_id: values.team_id || null,
      work_days_in_cycle: null as number[] | null,
    }

    if (editingItem) {
      updateMut.mutate(
        { id: editingItem.id, ...data },
        {
          onSuccess: () => { toast.success('Pattern updated'); setDialogOpen(false) },
          onError: (err: unknown) => toast.error(extractApiError(err, 'Operation failed')),
        },
      )
    } else {
      createMut.mutate(data, {
        onSuccess: () => { toast.success('Pattern created'); setDialogOpen(false) },
        onError: (err: unknown) => toast.error(extractApiError(err, 'Operation failed')),
      })
    }
  }

  function handleDelete(id: string) {
    deleteMut.mutate(id, {
      onSuccess: () => { toast.success('Pattern deleted'); setDeleteConfirm(null) },
      onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to delete pattern')),
    })
  }

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t.name]))

  const columns: Column<ShiftPattern>[] = [
    { header: 'Name', accessorKey: 'name', sortable: true },
    {
      header: 'Pattern',
      cell: (r) => (
        <Badge variant={r.work_days_in_cycle ? 'default' : 'outline'}>
          {formatPatternBadge(r)}
        </Badge>
      ),
      sortable: true,
      sortValue: (r) => r.pattern_days,
    },
    {
      header: 'Anchor Date',
      cell: (r) =>
        new Date(r.anchor_date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      sortable: true,
      sortValue: (r) => r.anchor_date,
    },
    {
      header: 'Team',
      cell: (r) => r.team_id ? teamMap.get(r.team_id) ?? 'Unknown' : <span className="text-muted-foreground">All</span>,
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
            onClick={() => setDeleteConfirm(r.id)}
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
        title="Shift Patterns"
        description="Define rotation cycles for shift scheduling (simple or complex)"
        actions={<Button onClick={openCreate}>+ Add Pattern</Button>}
      />

      {isError ? (
        <p className="text-sm text-destructive">Failed to load shift patterns.</p>
      ) : (
        <DataTable
          columns={columns}
          data={patterns ?? []}
          isLoading={isLoading}
          emptyMessage="No shift patterns defined"
          emptyDescription="Create a pattern to track shift rotation cycles."
          rowKey={(r) => r.id}
          pageSize={25}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) confirmClose(isDirty, () => setDialogOpen(false)) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Shift Pattern' : 'New Shift Pattern'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Name" htmlFor="sp-name" required error={errors.name?.message}>
              <Input id="sp-name" {...register('name')} placeholder="e.g. Pitman 2-2-3" />
            </FormField>

            <div>
              <Label className="text-sm font-medium mb-2 block">Pattern Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={patternMode === 'simple' ? 'default' : 'outline'}
                  onClick={() => setPatternMode('simple')}
                >
                  Simple (N-on M-off)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={patternMode === 'complex' ? 'default' : 'outline'}
                  onClick={() => setPatternMode('complex')}
                >
                  Complex (custom days)
                </Button>
              </div>
            </div>

            {patternMode === 'simple' ? (
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Work Days" htmlFor="sp-work" required error={errors.work_days?.message}>
                  <Input id="sp-work" type="number" min={0} {...register('work_days', { valueAsNumber: true })} />
                </FormField>
                <FormField label="Off Days" htmlFor="sp-off" required error={errors.off_days?.message}>
                  <Input id="sp-off" type="number" min={0} {...register('off_days', { valueAsNumber: true })} />
                </FormField>
                <FormField label="Cycle Length" htmlFor="sp-total" required error={errors.pattern_days?.message}>
                  <Input id="sp-total" type="number" min={1} {...register('pattern_days', { valueAsNumber: true })} />
                </FormField>
              </div>
            ) : (
              <div className="space-y-3">
                <FormField label="Cycle Length (days)" htmlFor="sp-total-c" required error={errors.pattern_days?.message}>
                  <Input id="sp-total-c" type="number" min={1} {...register('pattern_days', { valueAsNumber: true })} />
                </FormField>
                <FormField
                  label={`Work Days in Cycle (1-${watch('pattern_days') || '?'}, comma-separated)`}
                  htmlFor="sp-complex"
                >
                  <Input
                    id="sp-complex"
                    value={complexDays}
                    onChange={(e) => setComplexDays(e.target.value)}
                    placeholder="1, 2, 5, 6, 7, 10, 11"
                  />
                </FormField>
              </div>
            )}

            <FormField label="Anchor Date" htmlFor="sp-anchor" required error={errors.anchor_date?.message}>
              <Input id="sp-anchor" type="date" {...register('anchor_date')} />
            </FormField>
            <FormField label="Team (optional)" htmlFor="sp-team">
              <Select
                value={teamId || 'none'}
                onValueChange={(v) => setValue('team_id', v === 'none' ? '' : v, { shouldDirty: true })}
              >
                <SelectTrigger id="sp-team">
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All teams</SelectItem>
                  {(teams ?? []).filter((t) => t.is_active).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editingItem ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift Pattern?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate this shift pattern. This cannot be undone.
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

      {confirmDialog}
    </div>
  )
}
