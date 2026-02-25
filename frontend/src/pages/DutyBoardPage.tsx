import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { CalendarIcon, UserPlus, X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  useDutyPositions,
  useDutyAssignments,
  useCreateDutyAssignment,
  useUpdateDutyAssignment,
  useDeleteDutyAssignment,
  useUserDirectory,
  useShiftTemplates,
} from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import type { DutyPosition } from '@/api/dutyPositions'
import type { DutyAssignment } from '@/api/dutyPositions'
import { extractApiError } from '@/lib/format'

export default function DutyBoardPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [shiftFilter, setShiftFilter] = useState<string>('')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<DutyPosition | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<DutyAssignment | null>(null)
  const [removeTarget, setRemoveTarget] = useState<DutyAssignment | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [assignNotes, setAssignNotes] = useState('')

  const { isManager } = usePermissions()
  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  const { data: positions, isLoading: positionsLoading } = useDutyPositions()
  const { data: assignments, isLoading: assignmentsLoading } = useDutyAssignments(
    dateStr,
    shiftFilter && shiftFilter !== 'all' ? shiftFilter : undefined,
  )
  const { data: users } = useUserDirectory()
  const { data: shiftTemplates } = useShiftTemplates()

  const createMut = useCreateDutyAssignment()
  const updateMut = useUpdateDutyAssignment()
  const deleteMut = useDeleteDutyAssignment()

  const assignmentsByPosition = useMemo(() => {
    const map = new Map<string, DutyAssignment>()
    if (assignments) {
      for (const a of assignments) {
        map.set(a.duty_position_id, a)
      }
    }
    return map
  }, [assignments])

  const sortedUsers = useMemo(() => {
    if (!users) return []
    return [...users].sort((a, b) => {
      const nameA = `${a.last_name} ${a.first_name}`.toLowerCase()
      const nameB = `${b.last_name} ${b.first_name}`.toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }, [users])

  function openAssignDialog(position: DutyPosition, existing?: DutyAssignment) {
    setSelectedPosition(position)
    if (existing) {
      setEditingAssignment(existing)
      setSelectedUserId(existing.user_id)
      setAssignNotes(existing.notes ?? '')
    } else {
      setEditingAssignment(null)
      setSelectedUserId('')
      setAssignNotes('')
    }
    setAssignDialogOpen(true)
  }

  function handleAssign() {
    if (!selectedPosition || !selectedUserId) return

    if (editingAssignment) {
      updateMut.mutate(
        { id: editingAssignment.id, user_id: selectedUserId, notes: assignNotes || null },
        {
          onSuccess: () => {
            toast.success('Assignment updated')
            setAssignDialogOpen(false)
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
          duty_position_id: selectedPosition.id,
          user_id: selectedUserId,
          date: dateStr,
          shift_template_id: shiftFilter && shiftFilter !== 'all' ? shiftFilter : undefined,
          notes: assignNotes || undefined,
        },
        {
          onSuccess: () => {
            toast.success('User assigned to position')
            setAssignDialogOpen(false)
          },
          onError: (err: unknown) => {
            const msg = extractApiError(err, 'Operation failed')
            toast.error(msg)
          },
        },
      )
    }
  }

  function handleRemove() {
    if (!removeTarget) return
    deleteMut.mutate(removeTarget.id, {
      onSuccess: () => {
        toast.success('Assignment removed')
        setRemoveTarget(null)
      },
      onError: (err: unknown) => {
        const msg = extractApiError(err, 'Operation failed')
        toast.error(msg)
      },
    })
  }

  const isLoading = positionsLoading || assignmentsLoading

  return (
    <div>
      <PageHeader
        title="Duty Board"
        description="Daily position assignments"
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, 'EEE, MMM d, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (d) setSelectedDate(d)
                setCalendarOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>

        <Select value={shiftFilter} onValueChange={setShiftFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All shifts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All shifts</SelectItem>
            {shiftTemplates?.map((st) => (
              <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : !positions?.length ? (
        <p className="text-sm text-muted-foreground">
          No duty positions defined. {isManager ? 'Go to Admin > Duty Positions to create some.' : 'Contact an administrator to set up duty positions.'}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {positions.map((pos) => {
            const assignment = assignmentsByPosition.get(pos.id)
            return (
              <Card key={pos.id} className={cn('transition-colors', assignment ? 'border-primary/30' : 'border-dashed')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-sm">{pos.name}</h3>
                    </div>
                  </div>

                  {assignment ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {assignment.user_first_name} {assignment.user_last_name}
                        </p>
                        {assignment.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5">{assignment.notes}</p>
                        )}
                      </div>
                      {isManager && (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openAssignDialog(pos, assignment)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setRemoveTarget(assignment)}
                            disabled={deleteMut.isPending}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {isManager ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground gap-1.5 px-2"
                          onClick={() => openAssignDialog(pos)}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Assign
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Unassigned</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Assign / Edit dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Edit Assignment' : 'Assign Position'}
              {selectedPosition && ` - ${selectedPosition.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Employee</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {sortedUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.last_name}, {u.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Input
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedUserId || createMut.isPending || updateMut.isPending}
            >
              {editingAssignment ? 'Save' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove assignment confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.user_first_name} {removeTarget?.user_last_name} from this position? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={deleteMut.isPending}
            >
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
