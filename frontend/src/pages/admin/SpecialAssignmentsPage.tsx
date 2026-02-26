/* eslint-disable react-hooks/incompatible-library */
import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { Textarea } from '@/components/ui/textarea'
import {
  useSpecialAssignments,
  useCreateSpecialAssignment,
  useUpdateSpecialAssignment,
  useDeleteSpecialAssignment,
  useUsers,
} from '@/hooks/queries'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import { NO_VALUE, extractApiError } from '@/lib/format'
import type { SpecialAssignment } from '@/api/specialAssignments'

const COMMON_TYPES = [
  'Acting Supervisor',
  'Training',
  'Light Duty',
  'Detached',
  'Modified Duty',
  'Administrative',
]

const schema = z.object({
  user_id: z.string().min(1, 'User is required'),
  assignment_type: z.string().min(1, 'Assignment type is required'),
  custom_type: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function isActive(sa: SpecialAssignment): boolean {
  const today = format(new Date(), 'yyyy-MM-dd')
  return sa.start_date <= today && (sa.end_date === null || sa.end_date >= today)
}

export default function SpecialAssignmentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SpecialAssignment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SpecialAssignment | null>(null)
  const [filterType, setFilterType] = useState<string>('')
  const [showActiveOnly, setShowActiveOnly] = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')
  const listParams = useMemo(() => ({
    assignment_type: filterType || undefined,
    active_on: showActiveOnly ? today : undefined,
  }), [filterType, showActiveOnly, today])

  const { data: assignments, isLoading, isError } = useSpecialAssignments(listParams)
  const { data: users } = useUsers()
  const createMut = useCreateSpecialAssignment()
  const updateMut = useUpdateSpecialAssignment()
  const deleteMut = useDeleteSpecialAssignment()

  const { confirmClose, confirmDialog } = useConfirmClose()

  const { register, handleSubmit, reset, formState: { errors, isDirty }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const userId = watch('user_id')
  const assignmentType = watch('assignment_type')

  const activeUsers = (users ?? []).filter((u) => u.is_active)

  // Collect unique assignment types for filter dropdown
  const knownTypes = useMemo(() => {
    const types = new Set(COMMON_TYPES)
    ;(assignments ?? []).forEach((a) => types.add(a.assignment_type))
    return Array.from(types).sort()
  }, [assignments])

  function openCreate() {
    setEditingItem(null)
    reset({
      user_id: '',
      assignment_type: '',
      custom_type: '',
      start_date: today,
      end_date: '',
      notes: '',
    })
    setDialogOpen(true)
  }

  function openEdit(item: SpecialAssignment) {
    setEditingItem(item)
    const isCustom = !COMMON_TYPES.includes(item.assignment_type)
    reset({
      user_id: item.user_id,
      assignment_type: isCustom ? '__custom__' : item.assignment_type,
      custom_type: isCustom ? item.assignment_type : '',
      start_date: item.start_date,
      end_date: item.end_date ?? '',
      notes: item.notes ?? '',
    })
    setDialogOpen(true)
  }

  function onSubmit(values: FormValues) {
    const resolvedType = values.assignment_type === '__custom__'
      ? (values.custom_type ?? '').trim()
      : values.assignment_type

    if (!resolvedType) {
      toast.error('Please enter an assignment type')
      return
    }

    if (editingItem) {
      updateMut.mutate(
        {
          id: editingItem.id,
          assignment_type: resolvedType,
          end_date: values.end_date || null,
          notes: values.notes || null,
        },
        {
          onSuccess: () => {
            toast.success('Assignment updated')
            setDialogOpen(false)
          },
          onError: (err: unknown) => {
            const msg = extractApiError(err, 'Operation failed')
            toast.error(msg)
          },
        },
      )
    } else {
      createMut.mutate(
        {
          user_id: values.user_id,
          assignment_type: resolvedType,
          start_date: values.start_date,
          end_date: values.end_date || undefined,
          notes: values.notes || undefined,
        },
        {
          onSuccess: () => {
            toast.success('Assignment created')
            setDialogOpen(false)
          },
          onError: (err: unknown) => {
            const msg = extractApiError(err, 'Operation failed')
            toast.error(msg)
          },
        },
      )
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteMut.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Assignment deleted')
        setDeleteTarget(null)
      },
      onError: (err: unknown) => {
        const msg = extractApiError(err, 'Delete failed')
        toast.error(msg)
      },
    })
  }

  const columns: Column<SpecialAssignment>[] = [
    {
      header: 'Employee',
      cell: (r) => `${r.user_last_name}, ${r.user_first_name}`,
    },
    {
      header: 'Type',
      cell: (r) => (
        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
          {r.assignment_type}
        </span>
      ),
    },
    {
      header: 'Start Date',
      cell: (r) => r.start_date,
    },
    {
      header: 'End Date',
      cell: (r) => r.end_date ?? <span className="text-muted-foreground">Indefinite</span>,
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={isActive(r) ? 'active' : 'inactive'} />,
    },
    {
      header: 'Notes',
      cell: (r) => r.notes
        ? <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{r.notes}</span>
        : <span className="text-muted-foreground">--</span>,
    },
    {
      header: 'Actions',
      cell: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteTarget(r)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Special Assignments"
        description="Manage temporary role assignments such as Acting Supervisor, Training, or Light Duty"
        actions={<Button onClick={openCreate}>+ Add Assignment</Button>}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filterType || NO_VALUE} onValueChange={(v) => setFilterType(v === NO_VALUE ? '' : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_VALUE}>All Types</SelectItem>
            {knownTypes.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={showActiveOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowActiveOnly(!showActiveOnly)}
        >
          {showActiveOnly ? 'Active Only' : 'Show All'}
        </Button>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load special assignments.</p>
      ) : (
        <DataTable
          columns={columns}
          data={assignments ?? []}
          isLoading={isLoading}
          emptyMessage="No special assignments"
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) confirmClose(isDirty, () => setDialogOpen(false)) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Special Assignment' : 'New Special Assignment'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!editingItem && (
              <FormField label="Employee" htmlFor="sa-user" required error={errors.user_id?.message}>
                <Select value={userId || NO_VALUE} onValueChange={(v) => setValue('user_id', v === NO_VALUE ? '' : v)}>
                  <SelectTrigger id="sa-user">
                    <SelectValue placeholder="Select employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>Select...</SelectItem>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.last_name}, {u.first_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            <FormField label="Assignment Type" htmlFor="sa-type" required error={errors.assignment_type?.message}>
              <Select
                value={assignmentType || NO_VALUE}
                onValueChange={(v) => setValue('assignment_type', v === NO_VALUE ? '' : v)}
              >
                <SelectTrigger id="sa-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VALUE}>Select...</SelectItem>
                  {COMMON_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">Custom...</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {assignmentType === '__custom__' && (
              <FormField label="Custom Type" htmlFor="sa-custom-type" required>
                <Input id="sa-custom-type" {...register('custom_type')} placeholder="Enter custom assignment type" />
              </FormField>
            )}

            {!editingItem && (
              <FormField label="Start Date" htmlFor="sa-start" required error={errors.start_date?.message}>
                <Input id="sa-start" type="date" {...register('start_date')} />
              </FormField>
            )}

            <FormField label="End Date" htmlFor="sa-end">
              <Input id="sa-end" type="date" {...register('end_date')} />
            </FormField>

            <FormField label="Notes" htmlFor="sa-notes">
              <Textarea id="sa-notes" {...register('notes')} placeholder="Optional notes" rows={3} />
            </FormField>

            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editingItem ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Special Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this {deleteTarget?.assignment_type} assignment for {deleteTarget?.user_first_name} {deleteTarget?.user_last_name}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
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
