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
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useTeams, useCreateTeam, useUpdateTeam, useUsers } from '@/hooks/queries'
import { NO_VALUE } from '@/lib/format'
import type { TeamSummary } from '@/api/teams'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  supervisor_id: z.string().optional(),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export default function TeamsPage() {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TeamSummary | null>(null)

  const { data: teams, isLoading, isError } = useTeams()
  const { data: users } = useUsers()
  const createMut = useCreateTeam()
  const updateMut = useUpdateTeam()

  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const supervisorId = watch('supervisor_id')
  const isActive = watch('is_active')

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', supervisor_id: undefined, is_active: true })
    setDialogOpen(true)
  }

  function openEdit(item: TeamSummary) {
    setEditingItem(item)
    reset({
      name: item.name,
      supervisor_id: item.supervisor_id ?? undefined,
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  function onSubmit(values: FormValues) {
    if (editingItem) {
      updateMut.mutate(
        {
          id: editingItem.id,
          name: values.name,
          supervisor_id: values.supervisor_id || null,
          is_active: values.is_active,
        },
        {
          onSuccess: () => {
            toast.success('Team updated')
            setDialogOpen(false)
          },
        },
      )
    } else {
      createMut.mutate(
        { name: values.name, supervisor_id: values.supervisor_id || undefined },
        {
          onSuccess: () => {
            toast.success('Team created')
            setDialogOpen(false)
          },
        },
      )
    }
  }

  // Include the current supervisor in the dropdown even if they're deactivated
  const supervisors = (users ?? []).filter(
    (u) =>
      (u.is_active && (u.role === 'admin' || u.role === 'supervisor')) ||
      (editingItem && u.id === editingItem.supervisor_id),
  )

  const columns: Column<TeamSummary>[] = [
    {
      header: 'Name',
      cell: (r) => (
        <button
          className="text-primary hover:underline font-medium text-left"
          onClick={() => navigate(`/admin/teams/${r.id}`)}
        >
          {r.name}
        </button>
      ),
    },
    {
      header: 'Supervisor',
      cell: (r) => r.supervisor_name ?? <span className="text-muted-foreground">—</span>,
    },
    { header: 'Slots', cell: (r) => r.slot_count, className: 'w-20' },
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
        title="Teams"
        description="Manage teams and their shift slots"
        actions={<Button onClick={openCreate}>+ Add Team</Button>}
      />

      {isError ? (
        <p className="text-sm text-destructive">Failed to load teams.</p>
      ) : (
        <DataTable
          columns={columns}
          data={teams ?? []}
          isLoading={isLoading}
          emptyMessage="No teams"
          rowKey={(r) => r.id}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Team' : 'New Team'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Name" htmlFor="team-name" required error={errors.name?.message}>
              <Input id="team-name" {...register('name')} />
            </FormField>
            <FormField label="Supervisor" htmlFor="team-sup">
              <Select
                value={supervisorId || NO_VALUE}
                onValueChange={(v) => setValue('supervisor_id', v === NO_VALUE ? undefined : v)}
              >
                <SelectTrigger id="team-sup">
                  <SelectValue placeholder="Select supervisor…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VALUE}>None</SelectItem>
                  {supervisors.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.last_name}, {u.first_name}{!u.is_active ? ' (inactive)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {editingItem && (
              <div className="flex items-center gap-2">
                <Switch
                  id="team-active"
                  checked={isActive}
                  onCheckedChange={(v) => setValue('is_active', v)}
                />
                <Label htmlFor="team-active">Active</Label>
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
