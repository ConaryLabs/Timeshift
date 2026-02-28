import { useState, useMemo, useCallback } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ChevronLeft, ChevronRight, CalendarIcon, Clock, Plus, X, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BLOCK_LABELS, getCurrentBlockIndex, buildAssignmentMap } from '@/lib/dutyBoard'
import { usePermissions } from '@/hooks/usePermissions'
import { useDutyBoard, useCellAction, useAvailableStaff, useConsoleHours, useCreateDatePosition, useDeleteDatePosition } from '@/hooks/useDutyBoard'
import { useClassifications } from '@/hooks/queries'
import type { BoardAssignment, AvailableEmployee } from '@/api/dutyBoard'

function getMonthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(date, 'yyyy-MM-dd'),
  }
}

// Staff list shown in the assignment dialog
function StaffRow({
  employee,
  onSelect,
}: {
  employee: AvailableEmployee
  onSelect: () => void
}) {
  const isAlreadyAssigned = !!employee.already_assigned_position
  return (
    <button
      className={cn(
        'w-full text-left px-3 py-2 hover:bg-accent rounded flex items-center justify-between gap-2 text-sm',
        isAlreadyAssigned && 'opacity-50'
      )}
      onClick={onSelect}
      disabled={isAlreadyAssigned}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {employee.last_name}, {employee.first_name}
        </div>
        <div className="text-xs text-muted-foreground">
          {employee.shift_name} ({employee.shift_start}-{employee.shift_end})
          {employee.is_overtime && <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">OT</Badge>}
        </div>
        {isAlreadyAssigned && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400">
            Already at {employee.already_assigned_position}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {employee.console_hours_this_month}h
      </div>
    </button>
  )
}

// The assignment dialog content
function AssignmentDialogContent({
  date,
  positionId,
  positionName,
  blockIndex,
  currentAssignment,
  onAssign,
  onMarkOt,
  onClear,
}: {
  date: string
  positionId: string
  positionName: string
  blockIndex: number
  currentAssignment: BoardAssignment | undefined
  onAssign: (userId: string) => void
  onMarkOt: () => void
  onClear: () => void
}) {
  const { data: available, isLoading } = useAvailableStaff(
    date, blockIndex, positionId, true
  )

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-yellow-700 dark:text-yellow-400 border-yellow-300"
          onClick={onMarkOt}
        >
          Mark OT Needed
        </Button>
        {currentAssignment && (
          <Button variant="outline" size="sm" onClick={onClear}>
            {currentAssignment.status === 'ot_needed' ? 'Clear OT' : 'Clear Assignment'}
          </Button>
        )}
      </div>

      {/* Available staff list */}
      <div>
        <h4 className="text-sm font-medium mb-2">
          Available Staff
          <span className="text-xs text-muted-foreground ml-2">(sorted by fewest hours at {positionName})</span>
        </h4>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Loading eligible staff...</span>
          </div>
        ) : !available?.length ? (
          <div className="py-6 text-sm text-muted-foreground text-center border rounded-lg">
            No eligible staff for this block
          </div>
        ) : (
          <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
            {available.map((emp) => (
              <StaffRow
                key={emp.user_id}
                employee={emp}
                onSelect={() => onAssign(emp.user_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Console Hours Sheet content
function ConsoleHoursSheet({ date }: { date: Date }) {
  const { start, end } = getMonthRange(date)
  const { data: hours, isLoading } = useConsoleHours(start, end)

  const grouped = useMemo(() => {
    if (!hours) return []
    const map = new Map<string, { name: string; positions: Map<string, number>; total: number }>()
    for (const entry of hours) {
      const key = entry.user_id
      if (!map.has(key)) {
        map.set(key, {
          name: `${entry.last_name}, ${entry.first_name}`,
          positions: new Map(),
          total: 0,
        })
      }
      const user = map.get(key)!
      user.positions.set(entry.position_name, (user.positions.get(entry.position_name) || 0) + entry.hours)
      user.total += entry.hours
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [hours])

  const positions = useMemo(() => {
    if (!hours) return []
    return [...new Set(hours.map((h) => h.position_name))].sort()
  }, [hours])

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Console hours for {format(new Date(start), 'MMMM yyyy')} (through {format(date, 'MMM d')})
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !grouped.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No duty assignments this month</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th scope="col" className="text-left py-1.5 px-2 font-medium">Name</th>
                {positions.map((p) => (
                  <th scope="col" key={p} className="text-right py-1.5 px-2 font-medium">{p}</th>
                ))}
                <th scope="col" className="text-right py-1.5 px-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((user) => (
                <tr key={user.name} className="border-b">
                  <td className="py-1.5 px-2 font-medium">{user.name}</td>
                  {positions.map((p) => (
                    <td key={p} className="text-right py-1.5 px-2">
                      {user.positions.get(p) || '-'}
                    </td>
                  ))}
                  <td className="text-right py-1.5 px-2 font-medium">{user.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DutyBoardPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [activeCell, setActiveCell] = useState<{ positionId: string; blockIndex: number } | null>(null)
  const [addRowOpen, setAddRowOpen] = useState(false)
  const [newRowName, setNewRowName] = useState('')
  const [newRowClassification, setNewRowClassification] = useState<string>('')
  const { isManager } = usePermissions()

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const { data: board, isLoading, isError, refetch } = useDutyBoard(dateStr)
  const cellAction = useCellAction(dateStr)
  const createDatePosition = useCreateDatePosition(dateStr)
  const deleteDatePosition = useDeleteDatePosition(dateStr)
  const { data: classifications } = useClassifications()
  const currentBlock = getCurrentBlockIndex()

  // Build assignment lookup: positionId+blockIndex -> assignment
  const assignmentMap = useMemo(() => buildAssignmentMap(board?.assignments), [board?.assignments])

  const handleCellClick = useCallback((positionId: string, blockIndex: number) => {
    if (!isManager) return
    setActiveCell({ positionId, blockIndex })
  }, [isManager])

  const handleAssign = useCallback((userId: string) => {
    if (!activeCell) return
    cellAction.mutate(
      {
        duty_position_id: activeCell.positionId,
        block_index: activeCell.blockIndex,
        action: 'assign',
        user_id: userId,
      },
      { onSuccess: () => setActiveCell(null) }
    )
  }, [activeCell, cellAction])

  const handleMarkOt = useCallback(() => {
    if (!activeCell) return
    cellAction.mutate(
      {
        duty_position_id: activeCell.positionId,
        block_index: activeCell.blockIndex,
        action: 'mark_ot',
      },
      { onSuccess: () => setActiveCell(null) }
    )
  }, [activeCell, cellAction])

  const handleClear = useCallback(() => {
    if (!activeCell) return
    cellAction.mutate(
      {
        duty_position_id: activeCell.positionId,
        block_index: activeCell.blockIndex,
        action: 'clear',
      },
      { onSuccess: () => setActiveCell(null) }
    )
  }, [activeCell, cellAction])

  const activePosition = activeCell ? board?.positions.find((p) => p.id === activeCell.positionId) : null
  const activeAssignment = activeCell ? assignmentMap.get(`${activeCell.positionId}:${activeCell.blockIndex}`) : undefined

  return (
    <div className="space-y-4">
      <PageHeader
        title="Duty Board"
        description="Daily dispatch seating assignments"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/duty-board/display" target="_blank" rel="noopener noreferrer">
                <Monitor className="h-4 w-4 mr-1" />
                Display Mode
              </a>
            </Button>
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewRowName('')
                  setNewRowClassification('')
                  setAddRowOpen(true)
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Row
              </Button>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Clock className="h-4 w-4 mr-1" />
                  Console Hours
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Console Hours Report</SheetTitle>
                </SheetHeader>
                <ConsoleHoursSheet date={selectedDate} />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedDate((d) => subDays(d, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[140px]">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {format(selectedDate, 'EEE, MMM d')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                Today
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-12">
          <p className="text-destructive font-medium mb-2">Failed to load duty board.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !board?.positions.length ? (
        <div className="text-center py-12 text-muted-foreground">
          No duty positions configured. Go to Admin &gt; Duty Positions to set them up.
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th scope="col" className="border px-3 py-2 text-left font-semibold whitespace-nowrap w-[100px]">
                  Console
                </th>
                {BLOCK_LABELS.map((label, i) => (
                  <th
                    scope="col"
                    key={i}
                    className={cn(
                      'border px-1 py-2 text-center font-medium text-xs w-[72px]',
                      i === currentBlock && 'bg-blue-100 dark:bg-blue-900/30'
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.positions.map((position) => (
                <tr key={position.id} className={cn('hover:bg-muted/20', position.board_date && 'bg-blue-50/50 dark:bg-blue-950/20')}>
                  <td className="border px-3 py-1 font-semibold text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {position.name}
                      {position.required_qualifications.length > 0 && (
                        <span
                          className="text-[10px] text-muted-foreground"
                          title={position.required_qualifications.join(', ')}
                        >
                          ({position.required_qualifications.map((q) =>
                            q === 'Fire Dispatch' ? 'F' : q === 'Police Dispatch' ? 'P' : q[0]
                          ).join('')})
                        </span>
                      )}
                      {position.board_date && isManager && (
                        <button
                          className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove date-specific row"
                          aria-label={`Remove date-specific row ${position.name}`}
                          onClick={() => deleteDatePosition.mutate(position.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  {Array.from({ length: 12 }, (_, blockIndex) => {
                    const assignment = assignmentMap.get(`${position.id}:${blockIndex}`)
                    const isOpen = position.open_blocks[blockIndex]
                    const isActive =
                      activeCell?.positionId === position.id &&
                      activeCell?.blockIndex === blockIndex

                    // Closed cell
                    if (!isOpen) {
                      return (
                        <td
                          key={blockIndex}
                          className={cn(
                            'border px-1 py-0.5 text-center text-xs font-medium text-muted-foreground bg-muted/60 select-none',
                            blockIndex === currentBlock && 'ring-1 ring-inset ring-blue-400/40'
                          )}
                        >
                          X
                        </td>
                      )
                    }

                    const cellKeyDown = isManager
                      ? (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleCellClick(position.id, blockIndex)
                          }
                        }
                      : undefined

                    // OT needed
                    if (assignment?.status === 'ot_needed') {
                      return (
                        <td
                          key={blockIndex}
                          className={cn(
                            'border px-1 py-0.5 text-center text-xs font-bold bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
                            blockIndex === currentBlock && 'ring-1 ring-inset ring-blue-400/40',
                            isManager && 'cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900/60',
                            isActive && 'ring-2 ring-primary'
                          )}
                          onClick={() => handleCellClick(position.id, blockIndex)}
                          {...(isManager ? { tabIndex: 0, role: 'button' as const, onKeyDown: cellKeyDown, 'aria-label': `${position.name} ${BLOCK_LABELS[blockIndex]}: OT needed` } : {})}
                        >
                          OT
                        </td>
                      )
                    }

                    // Assigned
                    if (assignment?.status === 'assigned' && assignment.user_first_name) {
                      return (
                        <td
                          key={blockIndex}
                          className={cn(
                            'border px-1 py-0.5 text-center text-xs font-medium truncate max-w-[80px]',
                            blockIndex === currentBlock && 'ring-1 ring-inset ring-blue-400/40',
                            isManager && 'cursor-pointer hover:bg-accent',
                            isActive && 'ring-2 ring-primary'
                          )}
                          title={`${assignment.user_first_name} ${assignment.user_last_name}`}
                          onClick={() => handleCellClick(position.id, blockIndex)}
                          {...(isManager ? { tabIndex: 0, role: 'button' as const, onKeyDown: cellKeyDown, 'aria-label': `${position.name} ${BLOCK_LABELS[blockIndex]}: ${assignment.user_first_name} ${assignment.user_last_name}` } : {})}
                        >
                          {assignment.user_first_name}
                        </td>
                      )
                    }

                    // Empty open cell
                    return (
                      <td
                        key={blockIndex}
                        className={cn(
                          'border px-1 py-0.5 text-center text-xs',
                          blockIndex === currentBlock && 'ring-1 ring-inset ring-blue-400/40',
                          isManager && 'cursor-pointer hover:bg-accent/50',
                          isActive && 'ring-2 ring-primary'
                        )}
                        onClick={() => handleCellClick(position.id, blockIndex)}
                        {...(isManager ? { tabIndex: 0, role: 'button' as const, onKeyDown: cellKeyDown, 'aria-label': `${position.name} ${BLOCK_LABELS[blockIndex]}: empty` } : {})}
                      >
                        &nbsp;
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assignment dialog — renders outside the table */}
      <Dialog open={!!activeCell} onOpenChange={(open) => { if (!open) setActiveCell(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activePosition?.name} &mdash; {activeCell ? BLOCK_LABELS[activeCell.blockIndex] : ''}-{activeCell ? (BLOCK_LABELS[activeCell.blockIndex + 1] || '2400') : ''}
            </DialogTitle>
            <DialogDescription>Assign staff or mark overtime for this time block.</DialogDescription>
          </DialogHeader>
          {activeCell && activePosition && (
            <AssignmentDialogContent
              date={dateStr}
              positionId={activeCell.positionId}
              positionName={activePosition.name}
              blockIndex={activeCell.blockIndex}
              currentAssignment={activeAssignment}
              onAssign={handleAssign}
              onMarkOt={handleMarkOt}
              onClear={handleClear}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Row dialog for date-specific positions */}
      <Dialog open={addRowOpen} onOpenChange={setAddRowOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Row for {format(selectedDate, 'MMM d')}</DialogTitle>
            <DialogDescription>Add a date-specific duty position row.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!newRowName.trim()) return
              createDatePosition.mutate(
                {
                  name: newRowName.trim(),
                  classification_id: newRowClassification || undefined,
                },
                { onSuccess: () => setAddRowOpen(false) }
              )
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="add-row-name">Position Name</Label>
              <Input
                id="add-row-name"
                placeholder="e.g., FIRE 4"
                value={newRowName}
                onChange={(e) => setNewRowName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-row-class">Classification (optional)</Label>
              <Select value={newRowClassification} onValueChange={setNewRowClassification}>
                <SelectTrigger id="add-row-class">
                  <SelectValue placeholder="Any classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Any classification</SelectItem>
                  {classifications?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddRowOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newRowName.trim() || createDatePosition.isPending}>
                Add Row
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
