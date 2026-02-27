import { useState, useMemo } from 'react'
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
import { useCreateOtRequest, useAssignOtRequest, useDayView, useMandatoryOtOrder } from '@/hooks/queries'
import { formatTime, extractApiError } from '@/lib/format'
import type { ClassificationGap } from '@/api/coveragePlans'
import type { DayViewEntry, GridAssignment } from '@/api/schedule'

interface Props {
  gap: ClassificationGap
  date: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type OtDirection = 'holdover' | 'early_callout'

/** Parse "HH:MM" or "HH:MM:SS" to total minutes since midnight. */
function parseTimeToMin(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Add hours to a time string, wrapping around midnight. Returns "HH:MM:SS". */
function addHoursToTime(time: string, hours: number): string {
  const totalMinutes = ((parseTimeToMin(time) + hours * 60) % 1440 + 1440) % 1440
  const newH = Math.floor(totalMinutes / 60)
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:00`
}

/** Format "HH:MM:SS" or "HH:MM" to displayable time. */
function fmtTime(t: string): string {
  return formatTime(t)
}

interface EligibleEmployee {
  user_id: string
  first_name: string
  last_name: string
  shift_name: string
  shift_start: string
  shift_end: string
  ot_start: string
  ot_end: string
}

/**
 * Check if time `t` falls between `start` and `end` on a circular 24h clock.
 * All values in minutes [0, 1440). Handles ranges that cross midnight.
 */
function isTimeBetween(t: number, start: number, end: number): boolean {
  t = ((t % 1440) + 1440) % 1440
  start = ((start % 1440) + 1440) % 1440
  end = ((end % 1440) + 1440) % 1440
  if (start <= end) return t >= start && t <= end
  return t >= start || t <= end // range crosses midnight
}

/**
 * Check if two time ranges overlap. All values in minutes [0, 1440).
 * Handles ranges that cross midnight.
 */
function timeRangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  const aCrosses = aEnd <= aStart
  const bCrosses = bEnd <= bStart
  if (!aCrosses && !bCrosses) return aStart < bEnd && aEnd > bStart
  if (aCrosses && !bCrosses) return aStart < bEnd || aEnd > bStart
  if (!aCrosses && bCrosses) return bStart < aEnd || bEnd > aStart
  return true // both cross midnight — must overlap
}

/**
 * Find employees eligible for mandatory OT relative to a time block.
 *
 * Holdover: employees whose shift ends near the block — they stay longer.
 * Early callout: employees whose shift starts near the block — they come in early.
 *
 * Uses circular time comparison to handle midnight-crossing shifts and blocks
 * (e.g. Grave 22:00-06:00 people are holdover candidates for a 06:00-14:00 gap).
 */
function findBlockEligible(
  dayView: DayViewEntry[],
  classAbbr: string,
  blockStart: string,
  blockEnd: string,
  direction: OtDirection,
): EligibleEmployee[] {
  const blockStartMin = parseTimeToMin(blockStart)
  const rawBlockEndMin = parseTimeToMin(blockEnd)
  // Linear blockEnd for "already covers" check (extend past 1440 if block crosses midnight)
  const blockEndLinear = rawBlockEndMin <= blockStartMin ? rawBlockEndMin + 1440 : rawBlockEndMin

  const eligible: EligibleEmployee[] = []

  for (const shift of dayView) {
    const shiftStartMin = parseTimeToMin(shift.start_time)
    // Linear end for "already covers" check
    let shiftEndLinear = parseTimeToMin(shift.end_time)
    if (shift.crosses_midnight) shiftEndLinear += 1440

    // Filter to employees in the matching classification who aren't already on OT
    const matchingEmployees = shift.assignments.filter(
      (a) => a.classification_abbreviation === classAbbr && !a.is_overtime,
    )
    if (matchingEmployees.length === 0) continue

    // Does this shift already fully cover the block? (no point holding them over)
    const alreadyCoversBlock = (() => {
      if (!shift.crosses_midnight) {
        return shiftStartMin <= blockStartMin && shiftEndLinear >= blockEndLinear
      }
      // Midnight-crossing shift: normalize block into shift's linear timeframe
      // e.g. Grave 22:00-06:00 covers block 04:00-06:00 (morning portion)
      let normBlockStart = blockStartMin
      let normBlockEnd = blockEndLinear
      if (normBlockStart < shiftStartMin) {
        normBlockStart += 1440
        normBlockEnd += 1440
      }
      return shiftStartMin <= normBlockStart && shiftEndLinear >= normBlockEnd
    })()

    if (direction === 'holdover') {
      // Holdover: shift ends near/within the block → employee stays longer.
      // Circular check: shiftEnd ∈ [blockStart - 2h, blockEnd]
      const shiftEndCircular = parseTimeToMin(shift.end_time)
      const endInRange = isTimeBetween(shiftEndCircular, blockStartMin - 120, rawBlockEndMin)
      if (endInRange && !alreadyCoversBlock) {
        const otStart = shift.end_time
        const otEnd = addHoursToTime(shift.end_time, 2)
        // Verify OT window actually overlaps the block (not just adjacent)
        if (!timeRangesOverlap(parseTimeToMin(otStart), parseTimeToMin(otEnd), blockStartMin, rawBlockEndMin)) continue
        for (const emp of matchingEmployees) {
          eligible.push({
            user_id: emp.user_id,
            first_name: emp.first_name,
            last_name: emp.last_name,
            shift_name: shift.shift_name,
            shift_start: shift.start_time,
            shift_end: shift.end_time,
            ot_start: otStart,
            ot_end: otEnd,
          })
        }
      }
    } else {
      // Early callout: shift starts near/within the block → employee comes in early.
      // Circular check: shiftStart ∈ [blockStart, blockEnd + 2h]
      const startInRange = isTimeBetween(shiftStartMin, blockStartMin, rawBlockEndMin + 120)
      if (startInRange && !alreadyCoversBlock) {
        const otStart = addHoursToTime(shift.start_time, -2)
        const otEnd = shift.start_time
        // Verify OT window actually overlaps the block (not just adjacent)
        if (!timeRangesOverlap(parseTimeToMin(otStart), parseTimeToMin(otEnd), blockStartMin, rawBlockEndMin)) continue
        for (const emp of matchingEmployees) {
          eligible.push({
            user_id: emp.user_id,
            first_name: emp.first_name,
            last_name: emp.last_name,
            shift_name: shift.shift_name,
            shift_start: shift.start_time,
            shift_end: shift.end_time,
            ot_start: otStart,
            ot_end: otEnd,
          })
        }
      }
    }
  }

  return eligible
}

export default function MandatoryOTDialog({ gap, date, open, onOpenChange }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [direction, setDirection] = useState<OtDirection>('holdover')

  const { data: dayView } = useDayView(date)
  const { data: mandatoryOrder } = useMandatoryOtOrder(gap.classification_id)
  const createOt = useCreateOtRequest()
  const assignOt = useAssignOtRequest()

  const isBlockMode = !gap.shift_template_id

  // Legacy shift-based mode
  const shift = isBlockMode ? undefined : dayView?.find((s) => s.shift_template_id === gap.shift_template_id)

  // Legacy: eligible employees from a specific shift
  const legacyEligible: GridAssignment[] = shift?.assignments?.filter(
    (a) => a.classification_abbreviation === gap.classification_abbreviation && !a.is_overtime,
  ) ?? []

  // Block-based mode: parse block times from gap.shift_name ("HH:MM-HH:MM")
  const blockTimes = useMemo(() => {
    if (!isBlockMode) return null
    const match = gap.shift_name.match(/(\d{2}:\d{2})-(\d{2}:\d{2})$/)
    if (!match) return null
    return { start: match[1], end: match[2] }
  }, [isBlockMode, gap.shift_name])

  // Block mode: find eligible employees across all shifts
  const blockEligible = useMemo(() => {
    if (!isBlockMode || !dayView || !blockTimes) return []
    const eligible = findBlockEligible(dayView, gap.classification_abbreviation, blockTimes.start, blockTimes.end, direction)
    // Sort by mandatory OT order: most overdue first (never mandated → top, oldest → next)
    if (mandatoryOrder) {
      const orderMap = new Map(mandatoryOrder.map((e, i) => [e.user_id, i]))
      eligible.sort((a, b) => {
        const ai = orderMap.get(a.user_id) ?? Infinity
        const bi = orderMap.get(b.user_id) ?? Infinity
        return ai - bi
      })
    }
    return eligible
  }, [isBlockMode, dayView, blockTimes, gap.classification_abbreviation, direction, mandatoryOrder])

  const selectedBlockEmp = blockEligible.find((e) => e.user_id === selectedUserId)

  // OT time window
  const otStartTime = isBlockMode
    ? (selectedBlockEmp?.ot_start ?? '')
    : direction === 'holdover'
      ? (shift?.end_time ?? '')
      : (shift ? addHoursToTime(shift.start_time, -2) : '')
  const otEndTime = isBlockMode
    ? (selectedBlockEmp?.ot_end ?? '')
    : direction === 'holdover'
      ? (shift ? addHoursToTime(shift.end_time, 2) : '')
      : (shift?.start_time ?? '')

  const isSubmitting = createOt.isPending || assignOt.isPending

  function handleDirectionChange(d: OtDirection) {
    setDirection(d)
    setSelectedUserId('')
  }

  async function handleSubmit() {
    if (!selectedUserId || !otStartTime || !otEndTime) return

    let createdOtId: string | undefined
    try {
      const otReq = await createOt.mutateAsync({
        date,
        start_time: otStartTime,
        end_time: otEndTime,
        classification_id: gap.classification_id,
        is_fixed_coverage: true,
        notes: `Mandatory OT (${direction === 'holdover' ? 'holdover' : 'early callout'}): ${gap.classification_abbreviation} shortage${isBlockMode ? ` ${gap.shift_name}` : ` on ${gap.shift_name}`}`,
      })
      createdOtId = otReq.id

      await assignOt.mutateAsync({
        id: otReq.id,
        user_id: selectedUserId,
        ot_type: 'mandatory',
      })

      toast.success('Mandatory OT assigned')
      onOpenChange(false)
    } catch (err: unknown) {
      if (createdOtId) {
        try {
          const { api: client } = await import('@/api/client')
          await client.patch(`/api/ot-requests/${createdOtId}/cancel`)
        } catch { /* cleanup is best-effort */ }
      }
      toast.error(extractApiError(err, 'Failed to assign mandatory OT'))
    }
  }

  // Direction descriptions
  const holdoverDesc = isBlockMode && blockTimes
    ? `Extend past shift end to cover ${fmtTime(blockTimes.start)}-${fmtTime(blockTimes.end)}`
    : shift ? `${fmtTime(shift.end_time)} → ${fmtTime(addHoursToTime(shift.end_time, 2))}` : ''
  const earlyDesc = isBlockMode && blockTimes
    ? `Come in early to cover ${fmtTime(blockTimes.start)}-${fmtTime(blockTimes.end)}`
    : shift ? `${fmtTime(addHoursToTime(shift.start_time, -2))} → ${fmtTime(shift.start_time)}` : ''

  const DIRECTIONS: { value: OtDirection; label: string; desc: string }[] = [
    { value: 'holdover', label: 'Hold Over', desc: holdoverDesc },
    { value: 'early_callout', label: 'Early Callout', desc: earlyDesc },
  ]

  const eligibleList = isBlockMode ? blockEligible : legacyEligible

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
                <span className="text-sm font-medium">{isBlockMode ? `Block ${gap.shift_name}` : gap.shift_name}</span>
              </div>
              {shift && (
                <span className="text-xs text-muted-foreground">
                  {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
                </span>
              )}
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
              {DIRECTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleDirectionChange(value)}
                  disabled={isSubmitting}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    direction === value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-input bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-xs mt-0.5 text-muted-foreground">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Employee picker */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Employee</p>
            {eligibleList.length > 0 ? (
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {isBlockMode
                    ? blockEligible.map((e) => (
                        <SelectItem key={e.user_id} value={e.user_id}>
                          {e.first_name} {e.last_name} · {e.shift_name} ({fmtTime(e.shift_start)}–{fmtTime(e.shift_end)})
                        </SelectItem>
                      ))
                    : legacyEligible.map((e) => (
                        <SelectItem key={e.user_id} value={e.user_id}>
                          {e.first_name} {e.last_name}
                          {e.employee_id ? ` · ${e.employee_id}` : ''}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isBlockMode
                  ? `No ${gap.classification_abbreviation} employees on adjacent shifts eligible for ${direction === 'holdover' ? 'holdover' : 'early callout'}.`
                  : `No ${gap.classification_abbreviation} employees on ${gap.shift_name}. For day-off assignments, use the callout process.`}
              </p>
            )}
            {isBlockMode && selectedBlockEmp && (
              <p className="text-xs text-muted-foreground">
                OT: {fmtTime(selectedBlockEmp.ot_start)} – {fmtTime(selectedBlockEmp.ot_end)} (2hr extension of {selectedBlockEmp.shift_name})
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
            disabled={!selectedUserId || isSubmitting}
          >
            {isSubmitting ? 'Assigning…' : 'Assign Mandatory OT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
