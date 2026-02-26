import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent } from '@/components/ui/card'
import {
  useUsers,
  useLeaveTypes,
  useLeaveBalances,
  useLeaveBalanceHistory,
  useAdjustLeaveBalance,
  useAccrualSchedules,
  useCreateAccrualSchedule,
  useUpdateAccrualSchedule,
  useDeleteAccrualSchedule,
  useBargainingUnits,
} from '@/hooks/queries'
import type { LeaveBalanceView } from '@/api/leaveBalances'
import type { AccrualSchedule, AccrualTransaction } from '@/api/leaveBalances'
import { Link } from 'react-router-dom'
import { extractApiError } from '@/lib/format'

const EMPLOYEE_TYPES = [
  { value: 'regular_full_time', label: 'Regular Full Time' },
  { value: 'job_share', label: 'Job Share' },
  { value: 'medical_part_time', label: 'Medical Part Time' },
  { value: 'temp_part_time', label: 'Temp Part Time' },
]

type Tab = 'balances' | 'schedules'

export default function LeaveBalancesPage() {
  const [tab, setTab] = useState<Tab>('balances')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [adjustDialog, setAdjustDialog] = useState<{ leaveTypeId: string; leaveTypeName: string } | null>(null)
  const [adjustHours, setAdjustHours] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  // Accrual schedule form
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [scheduleDialog, setScheduleDialog] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<AccrualSchedule | null>(null)
  const [scheduleForm, setScheduleForm] = useState({
    leave_type_id: '',
    employee_type: 'regular_full_time',
    bargaining_unit: '',
    years_of_service_min: '0',
    years_of_service_max: '',
    hours_per_pay_period: '',
    max_balance_hours: '',
    effective_date: '',
  })

  const { data: users } = useUsers()
  const { data: leaveTypes } = useLeaveTypes()
  const { data: balances, isLoading: balancesLoading } = useLeaveBalances(selectedUserId || undefined)
  const { data: history, isLoading: historyLoading } = useLeaveBalanceHistory(selectedUserId, undefined)
  const adjustMut = useAdjustLeaveBalance()

  const { data: schedules, isLoading: schedulesLoading } = useAccrualSchedules()
  const createScheduleMut = useCreateAccrualSchedule()
  const updateScheduleMut = useUpdateAccrualSchedule()
  const deleteScheduleMut = useDeleteAccrualSchedule()
  const { data: bargainingUnits } = useBargainingUnits()

  function openAdjust(b: LeaveBalanceView) {
    setAdjustHours('')
    setAdjustNote('')
    setAdjustDialog({ leaveTypeId: b.leave_type_id, leaveTypeName: b.leave_type_name })
  }

  function handleAdjust() {
    if (!adjustDialog || !selectedUserId) return
    const hours = parseFloat(adjustHours)
    if (isNaN(hours) || hours === 0) return
    adjustMut.mutate(
      {
        user_id: selectedUserId,
        leave_type_id: adjustDialog.leaveTypeId,
        hours,
        note: adjustNote || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Balance adjusted')
          setAdjustDialog(null)
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Operation failed')
          toast.error(msg)
        },
      },
    )
  }

  function openCreateSchedule() {
    setEditingSchedule(null)
    setScheduleForm({
      leave_type_id: '',
      employee_type: 'regular_full_time',
      bargaining_unit: '',
      years_of_service_min: '0',
      years_of_service_max: '',
      hours_per_pay_period: '',
      max_balance_hours: '',
      effective_date: '',
    })
    setScheduleDialog(true)
  }

  function openEditSchedule(s: AccrualSchedule) {
    setEditingSchedule(s)
    setScheduleForm({
      leave_type_id: s.leave_type_id,
      employee_type: s.employee_type,
      bargaining_unit: s.bargaining_unit ?? '',
      years_of_service_min: String(s.years_of_service_min),
      years_of_service_max: s.years_of_service_max != null ? String(s.years_of_service_max) : '',
      hours_per_pay_period: String(s.hours_per_pay_period),
      max_balance_hours: s.max_balance_hours != null ? String(s.max_balance_hours) : '',
      effective_date: s.effective_date,
    })
    setScheduleDialog(true)
  }

  function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editingSchedule) {
      updateScheduleMut.mutate(
        {
          id: editingSchedule.id,
          hours_per_pay_period: parseFloat(scheduleForm.hours_per_pay_period),
          max_balance_hours: scheduleForm.max_balance_hours ? parseFloat(scheduleForm.max_balance_hours) : null,
          years_of_service_min: parseInt(scheduleForm.years_of_service_min),
          years_of_service_max: scheduleForm.years_of_service_max ? parseInt(scheduleForm.years_of_service_max) : null,
        },
        {
          onSuccess: () => {
            toast.success('Schedule updated')
            setScheduleDialog(false)
          },
          onError: (err: unknown) => {
            const msg = extractApiError(err, 'Operation failed')
            toast.error(msg)
          },
        },
      )
    } else {
      createScheduleMut.mutate(
        {
          leave_type_id: scheduleForm.leave_type_id,
          employee_type: scheduleForm.employee_type,
          bargaining_unit: scheduleForm.bargaining_unit || null,
          years_of_service_min: parseInt(scheduleForm.years_of_service_min) || 0,
          years_of_service_max: scheduleForm.years_of_service_max ? parseInt(scheduleForm.years_of_service_max) : undefined,
          hours_per_pay_period: parseFloat(scheduleForm.hours_per_pay_period),
          max_balance_hours: scheduleForm.max_balance_hours ? parseFloat(scheduleForm.max_balance_hours) : undefined,
          effective_date: scheduleForm.effective_date || undefined,
        },
        {
          onSuccess: () => {
            toast.success('Schedule created')
            setScheduleDialog(false)
          },
          onError: (err: unknown) => {
            const msg = extractApiError(err, 'Operation failed')
            toast.error(msg)
          },
        },
      )
    }
  }

  function handleDeleteSchedule(id: string) {
    deleteScheduleMut.mutate(id, {
      onSuccess: () => {
        toast.success('Schedule deleted')
        setDeleteTarget(null)
      },
      onError: (err: unknown) => {
        const msg = extractApiError(err, 'Operation failed')
        toast.error(msg)
      },
    })
  }

  const leaveTypeMap = new Map((leaveTypes ?? []).map((lt) => [lt.id, lt.name]))

  const balanceColumns: Column<LeaveBalanceView>[] = [
    { header: 'Leave Type', cell: (r) => r.leave_type_name },
    { header: 'Code', cell: (r) => r.leave_type_code },
    {
      header: 'Balance',
      cell: (r) => (
        <span className={r.balance_hours < 0 ? 'text-red-600 font-medium' : ''}>
          {r.balance_hours.toFixed(2)} hrs
        </span>
      ),
    },
    { header: 'As Of', accessorKey: 'as_of_date' },
    {
      header: 'Actions',
      cell: (r) => (
        <Button size="sm" variant="outline" onClick={() => openAdjust(r)}>
          Adjust
        </Button>
      ),
    },
  ]

  const historyColumns: Column<AccrualTransaction>[] = [
    {
      header: 'Date',
      cell: (r) => new Date(r.created_at).toLocaleDateString(),
    },
    {
      header: 'Leave Type',
      cell: (r) => leaveTypeMap.get(r.leave_type_id) ?? r.leave_type_id.slice(0, 8),
    },
    {
      header: 'Hours',
      cell: (r) => (
        <span className={r.hours < 0 ? 'text-red-600' : 'text-green-600'}>
          {r.hours > 0 ? '+' : ''}{r.hours.toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Reason',
      cell: (r) => <span className="capitalize">{r.reason}</span>,
    },
    { header: 'Note', cell: (r) => r.note ?? '' },
  ]

  const scheduleColumns: Column<AccrualSchedule>[] = [
    {
      header: 'Leave Type',
      cell: (r) => leaveTypeMap.get(r.leave_type_id) ?? r.leave_type_id.slice(0, 8),
    },
    {
      header: 'Employee Type',
      cell: (r) => EMPLOYEE_TYPES.find((t) => t.value === r.employee_type)?.label ?? r.employee_type,
    },
    {
      header: 'Bargaining Unit',
      cell: (r) => {
        if (!r.bargaining_unit) return <span className="text-muted-foreground">All</span>
        const bu = bargainingUnits?.find((b) => b.code === r.bargaining_unit)
        return bu ? bu.name : r.bargaining_unit
      },
    },
    {
      header: 'Years of Service',
      cell: (r) =>
        r.years_of_service_max != null
          ? `${r.years_of_service_min}–${r.years_of_service_max}`
          : `${r.years_of_service_min}+`,
    },
    {
      header: 'Hours/Period',
      cell: (r) => r.hours_per_pay_period.toFixed(2),
    },
    {
      header: 'Max Balance',
      cell: (r) => r.max_balance_hours != null ? `${r.max_balance_hours.toFixed(2)} hrs` : '—',
    },
    { header: 'Effective', accessorKey: 'effective_date' },
    {
      header: 'Actions',
      cell: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => openEditSchedule(r)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-700 hover:bg-red-50"
            onClick={() => setDeleteTarget(r.id)}
            disabled={deleteScheduleMut.isPending}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const selectedUser = users?.find((u) => u.id === selectedUserId)

  return (
    <div>
      <PageHeader
        title="Leave Balances"
        description="View and manage employee leave balances and accrual schedules"
      />

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 border-b" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'balances'}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'balances'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('balances')}
        >
          Employee Balances
        </button>
        <button
          role="tab"
          aria-selected={tab === 'schedules'}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'schedules'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('schedules')}
        >
          Accrual Schedules
        </button>
      </div>

      {tab === 'balances' && (
        <div>
          {/* Employee selector */}
          <div className="flex items-end gap-4 mb-6">
            <FormField label="Employee" htmlFor="bal-user">
              <Select value={selectedUserId} onValueChange={(v) => { setSelectedUserId(v); setShowHistory(false) }}>
                <SelectTrigger id="bal-user" className="w-[280px]">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).filter((u) => u.is_active).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.last_name}, {u.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {selectedUserId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? 'Hide History' : 'Show History'}
              </Button>
            )}
          </div>

          {selectedUserId ? (
            <>
              {/* Balance cards */}
              {balances && balances.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                  {balances.map((b) => (
                    <Card key={b.leave_type_id} className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow" onClick={() => openAdjust(b)}>
                      <CardContent className="p-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{b.leave_type_name}</p>
                        <p className={`text-2xl font-semibold mt-1 ${b.balance_hours < 0 ? 'text-red-600' : ''}`}>
                          {b.balance_hours.toFixed(1)}
                          <span className="text-sm font-normal text-muted-foreground ml-1">hrs</span>
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Balance table */}
              <DataTable
                columns={balanceColumns}
                data={balances ?? []}
                isLoading={balancesLoading}
                emptyMessage={`No leave balances for ${selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : 'this employee'}`}
                rowKey={(r) => r.leave_type_id}
              />

              {/* Transaction history */}
              {showHistory && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Transaction History</h3>
                  <DataTable
                    columns={historyColumns}
                    data={history ?? []}
                    isLoading={historyLoading}
                    emptyMessage="No transactions"
                    rowKey={(r) => r.id}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select an employee to view their leave balances.</p>
          )}
        </div>
      )}

      {tab === 'schedules' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={openCreateSchedule}>+ Add Schedule</Button>
          </div>
          {!schedulesLoading && (schedules ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-4 text-sm text-muted-foreground text-center">
              <p className="font-medium text-foreground mb-1">No accrual schedules configured</p>
              <p>Accrual schedules automatically add leave hours to employee balances each pay period based on employee type, bargaining unit, and years of service. Check <Link to="/admin/settings" className="text-primary underline">organization settings</Link> for fiscal year and pay period configuration before creating schedules.</p>
            </div>
          ) : (
            <DataTable
              columns={scheduleColumns}
              data={schedules ?? []}
              isLoading={schedulesLoading}
              emptyMessage="No accrual schedules configured"
              rowKey={(r) => r.id}
            />
          )}
        </div>
      )}

      {/* Adjust Balance Dialog */}
      <Dialog open={!!adjustDialog} onOpenChange={(open) => !open && setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Balance — {adjustDialog?.leaveTypeName}</DialogTitle>
            <DialogDescription>
              Enter a positive number to add hours, or negative to deduct.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Hours" htmlFor="adj-hours" required>
            <Input
              id="adj-hours"
              type="number"
              step="0.25"
              value={adjustHours}
              onChange={(e) => setAdjustHours(e.target.value)}
              placeholder="e.g. 8 or -4"
            />
          </FormField>
          <FormField label="Note" htmlFor="adj-note">
            <Textarea
              id="adj-note"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="Reason for adjustment…"
              rows={2}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={adjustMut.isPending || !adjustHours}>
              Adjust
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Accrual Schedule Dialog */}
      <Dialog open={scheduleDialog} onOpenChange={(open) => !open && setScheduleDialog(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Accrual Schedule' : 'New Accrual Schedule'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleScheduleSubmit} className="space-y-4">
            {!editingSchedule && (
              <FormField label="Leave Type" htmlFor="sched-lt" required>
                <Select value={scheduleForm.leave_type_id} onValueChange={(v) => setScheduleForm({ ...scheduleForm, leave_type_id: v })}>
                  <SelectTrigger id="sched-lt">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(leaveTypes ?? []).map((lt) => (
                      <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            {!editingSchedule && (
              <FormField label="Employee Type" htmlFor="sched-etype">
                <Select value={scheduleForm.employee_type} onValueChange={(v) => setScheduleForm({ ...scheduleForm, employee_type: v })}>
                  <SelectTrigger id="sched-etype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            {!editingSchedule && (
              <FormField label="Bargaining Unit" htmlFor="sched-bu">
                <Select value={scheduleForm.bargaining_unit || '__all'} onValueChange={(v) => setScheduleForm({ ...scheduleForm, bargaining_unit: v === '__all' ? '' : v })}>
                  <SelectTrigger id="sched-bu">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All Units</SelectItem>
                    {(bargainingUnits ?? []).filter((bu) => bu.is_active).map((bu) => (
                      <SelectItem key={bu.code} value={bu.code}>{bu.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Min Years of Service" htmlFor="sched-ymin">
                <Input
                  id="sched-ymin"
                  type="number"
                  min="0"
                  value={scheduleForm.years_of_service_min}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, years_of_service_min: e.target.value })}
                />
              </FormField>
              <FormField label="Max Years of Service" htmlFor="sched-ymax">
                <Input
                  id="sched-ymax"
                  type="number"
                  min="0"
                  value={scheduleForm.years_of_service_max}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, years_of_service_max: e.target.value })}
                  placeholder="No max"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Hours per Pay Period" htmlFor="sched-hpp" required>
                <Input
                  id="sched-hpp"
                  type="number"
                  step="0.01"
                  value={scheduleForm.hours_per_pay_period}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, hours_per_pay_period: e.target.value })}
                />
              </FormField>
              <FormField label="Max Balance Hours" htmlFor="sched-max">
                <Input
                  id="sched-max"
                  type="number"
                  step="0.01"
                  value={scheduleForm.max_balance_hours}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, max_balance_hours: e.target.value })}
                  placeholder="No cap"
                />
              </FormField>
            </div>
            {!editingSchedule && (
              <FormField label="Effective Date" htmlFor="sched-eff">
                <Input
                  id="sched-eff"
                  type="date"
                  value={scheduleForm.effective_date}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, effective_date: e.target.value })}
                />
              </FormField>
            )}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setScheduleDialog(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={
                  editingSchedule
                    ? updateScheduleMut.isPending
                    : createScheduleMut.isPending || !scheduleForm.leave_type_id || !scheduleForm.hours_per_pay_period
                }
              >
                {editingSchedule ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Accrual Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this accrual schedule. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDeleteSchedule(deleteTarget)}
              disabled={deleteScheduleMut.isPending}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
