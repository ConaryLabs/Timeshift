import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateOtRequest, useAssignOtRequest, useDayView } from '@/hooks/queries'
import type { ClassificationGap } from '@/api/coveragePlans'

interface Props {
  gap: ClassificationGap
  date: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function MandatoryOTDialog({ gap, date, open, onOpenChange }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const { data: dayView } = useDayView(date)
  const createOt = useCreateOtRequest()
  const assignOt = useAssignOtRequest()

  // Find the matching shift to get start/end times
  const shift = dayView?.find((s) => s.shift_template_id === gap.shift_template_id)

  // Get employees currently on shift today that match the gap classification
  const onShiftEmployees = shift?.assignments?.filter(
    (a) => a.classification_abbreviation === gap.classification_abbreviation && !a.is_overtime
  ) ?? []

  // Also get all employees across all shifts that could cover
  const allOnShift = dayView?.flatMap((s) =>
    s.assignments
      .filter((a) => !a.is_overtime)
      .map((a) => ({ ...a, shiftName: s.shift_name }))
  ) ?? []

  // Deduplicate by user_id
  const uniqueEmployees = Array.from(
    new Map(allOnShift.map((e) => [e.user_id, e])).values()
  )

  const isSubmitting = createOt.isPending || assignOt.isPending

  async function handleSubmit() {
    if (!selectedUserId || !shift) return

    try {
      // Create OT request with is_fixed_coverage
      const otReq = await createOt.mutateAsync({
        date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        classification_id: gap.classification_id,
        is_fixed_coverage: true,
        notes: `Mandatory OT: ${gap.classification_abbreviation} shortage on ${gap.shift_name}`,
      })

      // Immediately assign the selected employee
      await assignOt.mutateAsync({
        id: otReq.id,
        user_id: selectedUserId,
        ot_type: 'mandatory',
      })

      toast.success('Mandatory OT assigned successfully')
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign OT'
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Mandatory OT</DialogTitle>
          <DialogDescription>
            Fill a staffing gap by assigning mandatory overtime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Gap Info */}
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: gap.shift_color }}
                />
                <span className="text-sm font-medium">{gap.shift_name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {shift?.start_time} - {shift?.end_time}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                {gap.classification_abbreviation}
              </span>
              <span className="text-destructive font-medium tabular-nums">
                {gap.actual}/{gap.target}
              </span>
              <span className="text-muted-foreground text-xs">(need {gap.shortage} more)</span>
            </div>
          </div>

          {/* Employee Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Employee</label>
            {uniqueEmployees.length > 0 ? (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Show on-shift employees matching classification first */}
                  {onShiftEmployees.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        On this shift ({gap.classification_abbreviation})
                      </div>
                      {onShiftEmployees.map((e) => (
                        <SelectItem key={`match-${e.user_id}`} value={e.user_id}>
                          {e.first_name} {e.last_name}
                          {e.employee_id ? ` (${e.employee_id})` : ''}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    All on-shift employees
                  </div>
                  {uniqueEmployees.map((e) => (
                    <SelectItem key={e.user_id} value={e.user_id}>
                      {e.first_name} {e.last_name}
                      {e.employee_id ? ` (${e.employee_id})` : ''}
                      <span className="text-muted-foreground ml-1">- {e.shiftName}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                No employees currently on shift. Check the day schedule for available staff.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedUserId || !shift || isSubmitting}
          >
            {isSubmitting ? 'Assigning...' : 'Assign OT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
