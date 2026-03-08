// components/coverage/DayOffMandatoryDialog.tsx
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { useCreateOtRequest, useAssignOtRequest } from '@/hooks/queries'
import { formatTime, extractApiError, addHoursToTime } from '@/lib/format'

/** Convert "HH:MM:SS" → "HH:MM" for <input type="time" /> */
function toTimeInput(t: string): string {
  return t.substring(0, 5)
}

/** Convert "HH:MM" → "HH:MM:SS" */
function fromTimeInput(t: string): string {
  return `${t}:00`
}

interface AvailableEmployee {
  user_id: string
  first_name: string
  last_name: string
  employee_id?: string | null
}

interface Props {
  date: string
  defaultStartTime: string   // "HH:MM:SS"
  classificationId: string
  classificationAbbreviation: string
  employees: AvailableEmployee[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DURATIONS = [4, 5, 6] as const
type Duration = typeof DURATIONS[number]

export default function DayOffMandatoryDialog({
  date,
  defaultStartTime,
  classificationId,
  classificationAbbreviation,
  employees,
  open,
  onOpenChange,
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [startTimeInput, setStartTimeInput] = useState(toTimeInput(defaultStartTime))
  const [duration, setDuration] = useState<Duration>(4)

  const createOt = useCreateOtRequest()
  const assignOt = useAssignOtRequest()

  const isSubmitting = createOt.isPending || assignOt.isPending
  const startTimeFull = fromTimeInput(startTimeInput)
  const endTime = addHoursToTime(startTimeFull, duration)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedUserId('')
      setStartTimeInput(toTimeInput(defaultStartTime))
      setDuration(4)
    }
    onOpenChange(nextOpen)
  }

  async function handleSubmit() {
    if (!selectedUserId || !startTimeInput) return
    let createdOtId: string | undefined
    try {
      const otReq = await createOt.mutateAsync({
        date,
        start_time: startTimeFull,
        end_time: endTime,
        classification_id: classificationId,
        is_fixed_coverage: true,
        notes: `Mandatory OT (day off – ${duration}h): ${classificationAbbreviation} shortage`,
      })
      createdOtId = otReq.id

      await assignOt.mutateAsync({
        id: otReq.id,
        user_id: selectedUserId,
        ot_type: 'mandatory_day_off',
      })

      toast.success('Day-off mandatory OT assigned')
      onOpenChange(false)
    } catch (err: unknown) {
      // If the OT request was created but assignment failed, cancel the orphan
      if (createdOtId) {
        try {
          const { api: client } = await import('@/api/client')
          await client.patch(`/api/ot-requests/${createdOtId}/cancel`)
        } catch { /* cleanup is best-effort */ }
      }
      toast.error(extractApiError(err, 'Failed to assign day-off mandatory OT'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mandate Day-Off Employee</DialogTitle>
          <DialogDescription>
            Assign mandatory OT to an employee on their scheduled day off.
            Contract allows 4–6 hour blocks (VCCEA § 4.4.3).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Start time */}
          <FormField label="Start Time" htmlFor="doo-start" required>
            <Input
              id="doo-start"
              type="time"
              value={startTimeInput}
              onChange={(e) => setStartTimeInput(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          {/* Duration selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Duration</p>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  disabled={isSubmitting}
                  className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                    duration === d
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-input bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  {d}h
                </button>
              ))}
            </div>
            {startTimeInput && (
              <p className="text-xs text-muted-foreground">
                End time: {formatTime(endTime)}
              </p>
            )}
          </div>

          {/* Employee picker */}
          <FormField label="Employee" htmlFor="doo-employee" required>
            {employees.length > 0 ? (
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={isSubmitting}>
                <SelectTrigger id="doo-employee">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.user_id} value={e.user_id}>
                      {e.first_name} {e.last_name}
                      {e.employee_id ? ` · ${e.employee_id}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                No available {classificationAbbreviation} employees in the OT queue.
              </p>
            )}
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedUserId || !startTimeInput || isSubmitting}
          >
            {isSubmitting ? 'Assigning…' : 'Assign Day-Off OT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
