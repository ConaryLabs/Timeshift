// frontend/src/pages/admin/CoveragePlanAssignmentsPage.tsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState } from '@/components/ui/error-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FormField } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import {
  useCoveragePlans,
  useCoveragePlanAssignments,
  useCreateCoveragePlanAssignment,
  useDeleteCoveragePlanAssignment,
} from '@/hooks/queries'
import { mutationCallbacks } from '@/hooks/mutationCallbacks'
import type { CoveragePlanAssignment } from '@/api/coveragePlans'
import { formatDateFull, formatDate } from '@/lib/format'

const INITIAL_FORM = { plan_id: '', start_date: '', end_date: '', notes: '' }

export default function CoveragePlanAssignmentsPage() {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState(INITIAL_FORM)

  const { data: plans } = useCoveragePlans()
  const { data: assignments, isLoading, isError } = useCoveragePlanAssignments()
  const createMut = useCreateCoveragePlanAssignment()
  const deleteMut = useDeleteCoveragePlanAssignment()

  const planLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of plans ?? []) map.set(p.id, p.name)
    return map
  }, [plans])

  const activePlans = useMemo(
    () => (plans ?? []).filter((p) => p.is_active),
    [plans],
  )

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.plan_id || !form.start_date) {
      toast.error('Plan and start date are required')
      return
    }
    createMut.mutate(
      {
        plan_id: form.plan_id,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        notes: form.notes || undefined,
      },
      mutationCallbacks('Assignment created', () => { setDialogOpen(false); setForm(INITIAL_FORM) }, 'Create failed'),
    )
  }

  function handleDelete(id: string) {
    deleteMut.mutate(id, mutationCallbacks('Assignment deleted', () => setDeleteConfirm(null), 'Delete failed'))
  }


  const columns: Column<CoveragePlanAssignment>[] = [
    {
      header: 'Plan',
      cell: (r) => (
        <span className="font-medium">{planLookup.get(r.plan_id) ?? r.plan_id.slice(0, 8)}</span>
      ),
    },
    { header: 'Start Date', cell: (r) => formatDateFull(r.start_date) },
    {
      header: 'End Date',
      cell: (r) => r.end_date ? formatDateFull(r.end_date) : <Badge variant="outline">Open-ended</Badge>,
    },
    { header: 'Notes', cell: (r) => r.notes ?? '\u2014' },
    {
      header: 'Created',
      cell: (r) => formatDate(r.created_at),
    },
    {
      header: 'Actions',
      cell: (r) => (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteConfirm(r.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Coverage Plan Assignments"
        description="Assign coverage plans to date ranges. The most recent start date wins for any given day."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/coverage-plans')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Plans
            </Button>
            <Button onClick={() => { setForm(INITIAL_FORM); setDialogOpen(true) }}>+ Add Assignment</Button>
          </div>
        }
      />

      {isError ? (
        <ErrorState message="Failed to load assignments." />
      ) : (
        <DataTable
          columns={columns}
          data={assignments ?? []}
          isLoading={isLoading}
          emptyMessage="No date assignments"
          emptyDescription="The org's default plan will be used for all dates until an assignment is created."
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Date Assignment</DialogTitle>
            <DialogDescription>Assign a coverage plan to a date range.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormField label="Plan" htmlFor="assign-plan" required>
              <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                <SelectTrigger id="assign-plan">
                  <SelectValue placeholder="Select plan..." />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Start Date" htmlFor="assign-start" required>
              <Input
                id="assign-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </FormField>
            <FormField label="End Date" htmlFor="assign-end">
              <Input
                id="assign-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Leave blank for open-ended.</p>
            </FormField>
            <FormField label="Notes" htmlFor="assign-notes">
              <Textarea
                id="assign-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Optional notes..."
              />
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || !form.plan_id || !form.start_date}>
                Create Assignment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing this assignment means the org default plan will be used for this date range instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleteMut.isPending}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
