import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  useClassifications,
} from '@/hooks/queries'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/auth'
import { NO_VALUE } from '@/lib/format'
import type { UserProfile, Role, EmployeeType } from '@/store/auth'

const ROLES: Role[] = ['admin', 'supervisor', 'employee']
const EMPLOYEE_TYPES: { value: EmployeeType; label: string }[] = [
  { value: 'regular_full_time', label: 'Regular Full Time' },
  { value: 'job_share', label: 'Job Share' },
  { value: 'medical_part_time', label: 'Medical Part Time' },
  { value: 'temp_part_time', label: 'Temp Part Time' },
]

const createSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  employee_id: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'supervisor', 'employee'] as const),
  classification_id: z.string().optional(),
  employee_type: z.enum(['regular_full_time', 'job_share', 'medical_part_time', 'temp_part_time'] as const),
  hire_date: z.string().optional(),
  seniority_date: z.string().optional(),
})

const editSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  employee_id: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'supervisor', 'employee'] as const),
  classification_id: z.string().optional(),
  employee_type: z.enum(['regular_full_time', 'job_share', 'medical_part_time', 'temp_part_time'] as const),
  hire_date: z.string().optional(),
  seniority_date: z.string().optional(),
})

type CreateValues = z.infer<typeof createSchema>
type EditValues = z.infer<typeof editSchema>

const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-800 border-purple-200',
  supervisor: 'bg-blue-100 text-blue-800 border-blue-200',
  employee: 'bg-slate-100 text-slate-600 border-slate-200',
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<UserProfile | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<UserProfile | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const { data: users, isLoading, isError } = useUsers(showInactive)
  const { data: classifications } = useClassifications()
  const createMut = useCreateUser()
  const updateMut = useUpdateUser()
  const deactivateMut = useDeactivateUser()

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'employee', employee_type: 'regular_full_time' },
  })

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })

  // Include the editing user's classification even if inactive
  const editingClassificationId = editingItem?.classification_id
  const classificationOptions = (classifications ?? []).filter(
    (c) => c.is_active || (editingClassificationId && c.id === editingClassificationId),
  )

  function openCreate() {
    setEditingItem(null)
    createForm.reset({
      first_name: '',
      last_name: '',
      email: '',
      employee_id: '',
      phone: '',
      role: 'employee',
      classification_id: undefined,
      employee_type: 'regular_full_time',
      hire_date: '',
      seniority_date: '',
      password: '',
    })
    setDialogOpen(true)
  }

  function openEdit(item: UserProfile) {
    setEditingItem(item)
    editForm.reset({
      first_name: item.first_name,
      last_name: item.last_name,
      email: item.email,
      employee_id: item.employee_id ?? '',
      phone: item.phone ?? '',
      role: item.role,
      classification_id: item.classification_id ?? undefined,
      employee_type: item.employee_type,
      hire_date: item.hire_date ?? '',
      seniority_date: item.seniority_date ?? '',
    })
    setDialogOpen(true)
  }

  function onCreateSubmit(values: CreateValues) {
    createMut.mutate(
      {
        ...values,
        employee_id: values.employee_id || undefined,
        phone: values.phone || undefined,
        classification_id: values.classification_id || undefined,
        hire_date: values.hire_date || undefined,
        seniority_date: values.seniority_date || undefined,
      },
      {
        onSuccess: () => {
          toast.success('User created')
          setDialogOpen(false)
        },
      },
    )
  }

  function onEditSubmit(values: EditValues) {
    if (!editingItem) return
    updateMut.mutate(
      {
        id: editingItem.id,
        ...values,
        employee_id: values.employee_id || null,
        phone: values.phone || null,
        classification_id: values.classification_id || null,
        hire_date: values.hire_date || null,
        seniority_date: values.seniority_date || null,
      },
      {
        onSuccess: () => {
          toast.success('User updated')
          setDialogOpen(false)
        },
      },
    )
  }

  function handleDeactivate() {
    if (!deactivateTarget) return
    deactivateMut.mutate(deactivateTarget.id, {
      onSuccess: () => {
        toast.success('User deactivated')
        setDeactivateTarget(null)
      },
    })
  }

  const activeClassifications = (classifications ?? []).filter((c) => c.is_active)

  const columns: Column<UserProfile>[] = [
    {
      header: 'Name',
      cell: (r) => `${r.last_name}, ${r.first_name}`,
    },
    { header: 'Email', accessorKey: 'email' },
    {
      header: 'Role',
      cell: (r) => (
        <Badge variant="outline" className={`text-xs font-medium capitalize ${ROLE_COLORS[r.role]}`}>
          {r.role}
        </Badge>
      ),
    },
    {
      header: 'Classification',
      cell: (r) => r.classification_name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      header: 'Type',
      cell: (r) => EMPLOYEE_TYPES.find((t) => t.value === r.employee_type)?.label ?? r.employee_type,
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.is_active ? 'active' : 'inactive'} />,
    },
    {
      header: 'Actions',
      cell: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
            Edit
          </Button>
          {r.is_active && r.id !== currentUser?.id && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-700 hover:bg-red-50"
              onClick={() => setDeactivateTarget(r)}
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage user accounts and roles"
        actions={<Button onClick={openCreate}>+ Add User</Button>}
      />

      <div className="flex items-center gap-2 mb-4">
        <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
        <Label htmlFor="show-inactive" className="text-sm">Include inactive users</Label>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load users.</p>
      ) : (
        <DataTable
          columns={columns}
          data={users ?? []}
          isLoading={isLoading}
          emptyMessage="No users"
          rowKey={(r) => r.id}
        />
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit User' : 'New User'}</DialogTitle>
          </DialogHeader>

          {editingItem ? (
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="First Name" htmlFor="ue-first" required error={editForm.formState.errors.first_name?.message}>
                  <Input id="ue-first" {...editForm.register('first_name')} />
                </FormField>
                <FormField label="Last Name" htmlFor="ue-last" required error={editForm.formState.errors.last_name?.message}>
                  <Input id="ue-last" {...editForm.register('last_name')} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email" htmlFor="ue-email" required error={editForm.formState.errors.email?.message}>
                  <Input id="ue-email" type="email" {...editForm.register('email')} />
                </FormField>
                <FormField label="Employee ID" htmlFor="ue-eid">
                  <Input id="ue-eid" {...editForm.register('employee_id')} />
                </FormField>
              </div>
              <FormField label="Phone" htmlFor="ue-phone">
                <Input id="ue-phone" {...editForm.register('phone')} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Role" htmlFor="ue-role" required>
                  <Select
                    value={editForm.watch('role')}
                    onValueChange={(v) => editForm.setValue('role', v as Role)}
                    disabled={editingItem?.id === currentUser?.id}
                  >
                    <SelectTrigger id="ue-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editingItem?.id === currentUser?.id && (
                    <p className="text-xs text-muted-foreground mt-1">You cannot change your own role</p>
                  )}
                </FormField>
                <FormField label="Classification" htmlFor="ue-cls">
                  <Select
                    value={editForm.watch('classification_id') || NO_VALUE}
                    onValueChange={(v) => editForm.setValue('classification_id', v === NO_VALUE ? undefined : v)}
                  >
                    <SelectTrigger id="ue-cls">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VALUE}>None</SelectItem>
                      {classificationOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{!c.is_active ? ' (inactive)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label="Employee Type" htmlFor="ue-type" required>
                <Select
                  value={editForm.watch('employee_type')}
                  onValueChange={(v) => editForm.setValue('employee_type', v as EmployeeType)}
                >
                  <SelectTrigger id="ue-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Hire Date" htmlFor="ue-hire">
                  <Input id="ue-hire" type="date" {...editForm.register('hire_date')} />
                </FormField>
                <FormField label="Seniority Date" htmlFor="ue-sen">
                  <Input id="ue-sen" type="date" {...editForm.register('seniority_date')} />
                </FormField>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMut.isPending}>Save Changes</Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="First Name" htmlFor="uc-first" required error={createForm.formState.errors.first_name?.message}>
                  <Input id="uc-first" {...createForm.register('first_name')} />
                </FormField>
                <FormField label="Last Name" htmlFor="uc-last" required error={createForm.formState.errors.last_name?.message}>
                  <Input id="uc-last" {...createForm.register('last_name')} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email" htmlFor="uc-email" required error={createForm.formState.errors.email?.message}>
                  <Input id="uc-email" type="email" {...createForm.register('email')} />
                </FormField>
                <FormField label="Password" htmlFor="uc-pass" required error={createForm.formState.errors.password?.message}>
                  <Input id="uc-pass" type="password" {...createForm.register('password')} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Employee ID" htmlFor="uc-eid">
                  <Input id="uc-eid" {...createForm.register('employee_id')} />
                </FormField>
                <FormField label="Phone" htmlFor="uc-phone">
                  <Input id="uc-phone" {...createForm.register('phone')} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Role" htmlFor="uc-role" required>
                  <Select
                    value={createForm.watch('role')}
                    onValueChange={(v) => createForm.setValue('role', v as Role)}
                  >
                    <SelectTrigger id="uc-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Classification" htmlFor="uc-cls">
                  <Select
                    value={createForm.watch('classification_id') || NO_VALUE}
                    onValueChange={(v) => createForm.setValue('classification_id', v === NO_VALUE ? undefined : v)}
                  >
                    <SelectTrigger id="uc-cls">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VALUE}>None</SelectItem>
                      {activeClassifications.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label="Employee Type" htmlFor="uc-type" required>
                <Select
                  value={createForm.watch('employee_type')}
                  onValueChange={(v) => createForm.setValue('employee_type', v as EmployeeType)}
                >
                  <SelectTrigger id="uc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Hire Date" htmlFor="uc-hire">
                  <Input id="uc-hire" type="date" {...createForm.register('hire_date')} />
                </FormField>
                <FormField label="Seniority Date" htmlFor="uc-sen">
                  <Input id="uc-sen" type="date" {...createForm.register('seniority_date')} />
                </FormField>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMut.isPending}>Create</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation dialog */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <strong>{deactivateTarget?.first_name} {deactivateTarget?.last_name}</strong>?
              They will no longer be able to log in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={deactivateMut.isPending}>
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
