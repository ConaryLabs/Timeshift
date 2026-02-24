import { useState, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
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
import { FormField } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  useClassifications,
  queryKeys,
} from '@/hooks/queries'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/auth'
import { SearchInput } from '@/components/ui/search-input'
import { useDebounce } from '@/hooks/useDebounce'
import { useConfirmClose } from '@/hooks/useConfirmClose'
import { ConflictDialog } from '@/components/ConflictDialog'
import { NO_VALUE } from '@/lib/format'
import { isConflictError } from '@/lib/utils'
import type { UserProfile, Role, EmployeeType, EmployeeStatus } from '@/store/auth'

const ROLES: Role[] = ['admin', 'supervisor', 'employee']
const EMPLOYEE_TYPES: { value: EmployeeType; label: string }[] = [
  { value: 'regular_full_time', label: 'Regular Full Time' },
  { value: 'job_share', label: 'Job Share' },
  { value: 'medical_part_time', label: 'Medical Part Time' },
  { value: 'temp_part_time', label: 'Temp Part Time' },
]
const EMPLOYEE_STATUSES: { value: EmployeeStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'unpaid_loa', label: 'Unpaid LOA' },
  { value: 'lwop', label: 'LWOP' },
  { value: 'layoff', label: 'Layoff' },
  { value: 'separated', label: 'Separated' },
]
const PAUSING_STATUSES: EmployeeStatus[] = ['unpaid_loa', 'lwop', 'layoff']
const STATUS_COLORS: Record<EmployeeStatus, string> = {
  active: '',
  unpaid_loa: 'bg-amber-100 text-amber-800 border-amber-200',
  lwop: 'bg-amber-100 text-amber-800 border-amber-200',
  layoff: 'bg-red-100 text-red-800 border-red-200',
  separated: 'bg-slate-100 text-slate-500 border-slate-200',
}

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
  overall_seniority_date: z.string().optional(),
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
  overall_seniority_date: z.string().optional(),
  employee_status: z.enum(['active', 'unpaid_loa', 'lwop', 'layoff', 'separated'] as const),
  seniority_pause_exception: z.boolean().optional(),
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
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<UserProfile | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<UserProfile | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [classFilter, setClassFilter] = useState<string>('all')
  const debouncedSearch = useDebounce(search)
  const [conflictOpen, setConflictOpen] = useState(false)

  const { data: users, isLoading, isError } = useUsers({ include_inactive: showInactive })
  const { data: classifications } = useClassifications()
  const createMut = useCreateUser()
  const updateMut = useUpdateUser()
  const pendingEditVars = useRef<Parameters<typeof updateMut.mutate>[0] | null>(null)
  const deactivateMut = useDeactivateUser()

  const { confirmClose, confirmDialog } = useConfirmClose()

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
      overall_seniority_date: '',
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
      overall_seniority_date: item.overall_seniority_date ?? '',
      employee_status: item.employee_status,
      seniority_pause_exception: false,
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
        overall_seniority_date: values.overall_seniority_date || undefined,
      },
      {
        onSuccess: () => {
          toast.success('User created')
          setDialogOpen(false)
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Operation failed'
          toast.error(msg)
        },
      },
    )
  }

  function onEditSubmit(values: EditValues) {
    if (!editingItem) return
    const vars = {
      id: editingItem.id,
      ...values,
      employee_id: values.employee_id || null,
      phone: values.phone || null,
      classification_id: values.classification_id || null,
      hire_date: values.hire_date || null,
      overall_seniority_date: values.overall_seniority_date || null,
      employee_status: values.employee_status,
      seniority_pause_exception: values.seniority_pause_exception ?? false,
      expected_updated_at: editingItem.updated_at,
    }
    pendingEditVars.current = vars
    updateMut.mutate(vars, {
      onSuccess: () => {
        toast.success('User updated')
        setDialogOpen(false)
      },
      onError: (err: unknown) => {
        if (isConflictError(err)) {
          setConflictOpen(true)
          return
        }
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Operation failed'
        toast.error(msg)
      },
    })
  }

  function handleConflictReload() {
    setConflictOpen(false)
    setDialogOpen(false)
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
  }

  function handleConflictForceSave() {
    setConflictOpen(false)
    if (!pendingEditVars.current) return
    updateMut.mutate({ ...pendingEditVars.current, expected_updated_at: undefined }, {
      onSuccess: () => {
        toast.success('User updated')
        setDialogOpen(false)
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Operation failed'
        toast.error(msg)
      },
    })
  }

  function handleDeactivate() {
    if (!deactivateTarget) return
    deactivateMut.mutate(deactivateTarget.id, {
      onSuccess: () => {
        toast.success('User deactivated')
        setDeactivateTarget(null)
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Operation failed'
        toast.error(msg)
      },
    })
  }

  const activeClassifications = (classifications ?? []).filter((c) => c.is_active)

  const filteredUsers = useMemo(() => {
    let result = users ?? []
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(
        (u) =>
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
    }
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter)
    }
    if (classFilter !== 'all') {
      result = result.filter((u) => u.classification_id === classFilter)
    }
    return result
  }, [users, debouncedSearch, roleFilter, classFilter])

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
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={r.is_active}
            onCheckedChange={(checked) => {
              if (!checked) {
                setDeactivateTarget(r)
              } else {
                updateMut.mutate(
                  { id: r.id, is_active: true },
                  {
                    onSuccess: () => toast.success('User activated'),
                    onError: (err: unknown) => {
                      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Operation failed'
                      toast.error(msg)
                    },
                  },
                )
              }
            }}
            disabled={r.id === currentUser?.id}
            aria-label={`Toggle active status for ${r.first_name} ${r.last_name}`}
          />
          {r.employee_status !== 'active' && (
            <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[r.employee_status]}`}>
              {EMPLOYEE_STATUSES.find((s) => s.value === r.employee_status)?.label ?? r.employee_status}
            </Badge>
          )}
        </div>
      ),
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
        title="Users"
        description="Manage user accounts and roles"
        actions={<Button onClick={openCreate}>+ Add User</Button>}
      />

      <div className="flex items-center gap-2 mb-4">
        <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
        <Label htmlFor="show-inactive" className="text-sm">Include inactive users</Label>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email..." className="w-64" />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classifications</SelectItem>
            {activeClassifications.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load users.</p>
      ) : (
        <DataTable
          columns={columns}
          data={filteredUsers}
          isLoading={isLoading}
          emptyMessage="No users"
          rowKey={(r) => r.id}
        />
      )}

      {/* Create / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            const dirty = editingItem ? editForm.formState.isDirty : createForm.formState.isDirty
            confirmClose(dirty, () => setDialogOpen(false))
          }
        }}
      >
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
                  <Input id="ue-sen" type="date" {...editForm.register('overall_seniority_date')} />
                </FormField>
              </div>
              <FormField label="Leave / Employment Status" htmlFor="ue-status">
                <Select
                  value={editForm.watch('employee_status')}
                  onValueChange={(v) => {
                    editForm.setValue('employee_status', v as EmployeeStatus, { shouldDirty: true })
                    // Reset exception flag when status changes
                    editForm.setValue('seniority_pause_exception', false)
                  }}
                >
                  <SelectTrigger id="ue-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {PAUSING_STATUSES.includes(editForm.watch('employee_status')) && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ue-exception"
                      {...editForm.register('seniority_pause_exception')}
                      className="h-4 w-4 rounded border"
                    />
                    <label htmlFor="ue-exception" className="text-xs text-muted-foreground">
                      Exception — seniority continues (OJI / maternity / military)
                    </label>
                  </div>
                )}
                {editingItem?.accrual_paused_since && (
                  <p className="text-xs text-amber-600 mt-1">
                    Accrual paused since {editingItem.accrual_paused_since}
                  </p>
                )}
              </FormField>
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
                  <Input id="uc-sen" type="date" {...createForm.register('overall_seniority_date')} />
                </FormField>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMut.isPending}>Create</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {confirmDialog}

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

      <ConflictDialog
        open={conflictOpen}
        onReload={handleConflictReload}
        onForceSave={handleConflictForceSave}
        onCancel={() => setConflictOpen(false)}
      />
    </div>
  )
}
