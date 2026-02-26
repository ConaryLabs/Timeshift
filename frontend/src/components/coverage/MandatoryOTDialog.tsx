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
import { formatTime } from '@/lib/format'
import type { ClassificationGap } from '@/api/coveragePlans'

interface Props {
  gap: ClassificationGap
  date: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type OtDirection = 'holdover' | 'early_callout'

/** Add (or subtract) hours from a HH:MM:SS time string, wrapping around midnight. */
function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number)
  const totalMinutes = ((h * 60 + m + hours * 60) % 1440 + 1440) % 1440
  const newH = Math.floor(totalMinutes / 60)
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:00`
}

export default function MandatoryOTDialog({ gap, date, open, onOpenChange }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [direction, setDirection] = useState<OtDirection>('holdover')

  const { data: dayView } = useDayView(date)
  const createOt = useCreateOtRequest()
  const assignOt = useAssignOtRequest()

  const shift = dayView?.find((s) => s.shift_template_id === gap.shift_template_id)

  // 2-hour OT window — holdover extends past the shift end; early callout precedes the shift start
  const otStartTime = direction === 'holdover'
    ? (shift?.end_time ?? '')
    : (shift ? addHoursToTime(shift.start_time, -2) : '')
  const otEndTime = direction === 'holdover'
    ? (shift ? addHoursToTime(shift.end_time, 2) : '')
    : (shift?.start_time ?? '')

  // Only employees on this shift matching the gap classification are eligible
  const eligibleEmployees = shift?.assignments?.filter(
    (a) => a.classification_abbreviation === gap.classification_abbreviation && !a.is_overtime,
  ) ?? []

  const isSubmitting = createOt.isPending || assignOt.isPending

  function handleDirectionChange(d: OtDirection) {
    setDirection(d)
    setSelectedUserId('')
  }

  async function handleSubmit() {
    if (!selectedUserId || !shift || !otStartTime || !otEndTime) return

    try {
      const otReq = await createOt.mutateAsync({
        date,
        start_time: otStartTime,
        end_time: otEndTime,
        classification_id: gap.classification_id,
        is_fixed_coverage: true,
        notes: `Mandatory OT (${direction === 'holdover' ? 'holdover' : 'early callout'}): ${gap.classification_abbreviation} shortage on ${gap.shift_name}`,
      })

      await assignOt.mutateAsync({
        id: otReq.id,
        user_id: selectedUserId,
        ot_type: 'mandatory',
      })

      toast.success('Mandatory OT assigned')
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign mandatory OT'
      toast.error(message)
    }
  }

  const DIRECTIONS: { value: OtDirection; label: string; sublabel: (s: typeof shift) => string }[] = [
    {
      value: 'holdover',
      label: 'Hold Over',
      sublabel: (s) => s ? `${formatTime(s.end_time)} → ${formatTime(addHoursToTime(s.end_time, 2))}` : '',
    },
    {
      value: 'early_callout',
      label: 'Early Callout',
      sublabel: (s) => s ? `${formatTime(addHoursToTime(s.start_time, -2))} → ${formatTime(s.start_time)}` : '',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Mandatory OT</DialogTitle>
          <DialogDescription>
            Contract limit: max 2 hours before or after the employee's scheduled shift (VCCEA § 4.4.3).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Gap summary */}
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: gap.shift_color }} />
                <span className="text-sm font-medium">{gap.shift_name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {shift ? `${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}` : '—'}
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

          {/* Direction selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Extension type</p>
            <div className="grid grid-cols-2 gap-2">
              {DIRECTIONS.map(({ value, label, sublabel }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleDirectionChange(value)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    direction === value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-input bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-xs mt-0.5 text-muted-foreground">{sublabel(shift)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Employee picker */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Employee</p>
            {eligibleEmployees.length > 0 ? (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleEmployees.map((e) => (
                    <SelectItem key={e.user_id} value={e.user_id}>
                      {e.first_name} {e.last_name}
                      {e.employee_id ? ` · ${e.employee_id}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                No {gap.classification_abbreviation} employees on {gap.shift_name}.
                For day-off assignments, use the callout process.
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
            {isSubmitting ? 'Assigning…' : 'Assign Mandatory OT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
