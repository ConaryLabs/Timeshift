// frontend/src/pages/admin/CoveragePlansPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Pencil, Trash2, CalendarRange, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState } from '@/components/ui/error-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FormField } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  useCoveragePlans,
  useCreateCoveragePlan,
  useUpdateCoveragePlan,
  useDeleteCoveragePlan,
} from '@/hooks/queries'
import type { CoveragePlanView } from '@/api/coveragePlans'
import { extractApiError } from '@/lib/format'

const INITIAL_FORM = { name: '', description: '', isDefault: false }

export default function CoveragePlansPage() {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<CoveragePlanView | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState(INITIAL_FORM)

  const { data: plans, isLoading, isError } = useCoveragePlans()
  const createMut = useCreateCoveragePlan()
  const updateMut = useUpdateCoveragePlan()
  const deleteMut = useDeleteCoveragePlan()

  function openCreate() {
    setEditingPlan(null)
    setForm(INITIAL_FORM)
    setDialogOpen(true)
  }

  function openEdit(plan: CoveragePlanView) {
    setEditingPlan(plan)
    setForm({ name: plan.name, description: plan.description ?? '', isDefault: plan.is_default })
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Plan name is required')
      return
    }
    if (editingPlan) {
      updateMut.mutate(
        { id: editingPlan.id, name: form.name.trim(), description: form.description || undefined, is_default: form.isDefault },
        {
          onSuccess: () => { toast.success('Plan updated'); setDialogOpen(false) },
          onError: (err) => toast.error(extractApiError(err, 'Update failed')),
        },
      )
    } else {
      createMut.mutate(
        { name: form.name.trim(), description: form.description || undefined, is_default: form.isDefault },
        {
          onSuccess: () => { toast.success('Plan created'); setDialogOpen(false) },
          onError: (err) => toast.error(extractApiError(err, 'Create failed')),
        },
      )
    }
  }

  function handleDelete(id: string) {
    deleteMut.mutate(id, {
      onSuccess: () => { toast.success('Plan deleted'); setDeleteConfirm(null) },
      onError: (err) => toast.error(extractApiError(err, 'Delete failed')),
    })
  }

  const columns: Column<CoveragePlanView>[] = [
    {
      header: 'Name',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.name}</span>
          {r.is_default && <Badge variant="secondary">Default</Badge>}
          {!r.is_active && <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
        </div>
      ),
    },
    { header: 'Description', cell: (r) => r.description ?? '\u2014' },
    { header: 'Slots', cell: (r) => r.slot_count.toString() },
    { header: 'Assignments', cell: (r) => r.assignment_count.toString() },
    {
      header: 'Actions',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => navigate(`/admin/coverage-plans/${r.id}`)}>
            <Grid3x3 className="h-3.5 w-3.5 mr-1" />
            Edit Slots
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteConfirm(r.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Coverage Plans"
        description="Named plans defining per-half-hour staffing requirements."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/coverage-plans/assignments')}>
              <CalendarRange className="h-4 w-4 mr-1.5" />
              Date Assignments
            </Button>
            <Button onClick={openCreate}>+ Add Plan</Button>
          </div>
        }
      />

      {isError ? (
        <ErrorState message="Failed to load coverage plans." />
      ) : (
        <DataTable
          columns={columns}
          data={plans ?? []}
          isLoading={isLoading}
          emptyMessage="No coverage plans configured"
          emptyDescription="Create a plan to define per-half-hour staffing requirements."
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'New Coverage Plan'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Plan Name" htmlFor="plan-name" required>
              <Input id="plan-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="Description" htmlFor="plan-desc">
              <Textarea id="plan-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </FormField>
            <div className="flex items-center gap-3">
              <Switch id="plan-default" checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
              <Label htmlFor="plan-default">Set as org default plan</Label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editingPlan ? 'Save Changes' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the plan and all its slot configurations. Date assignments using this plan will also be removed.
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
