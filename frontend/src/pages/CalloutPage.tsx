import { useState } from 'react'
import { format, addDays } from 'date-fns'
import { Button } from '@/components/ui/button'
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
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { FormField } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  useCalloutEvents,
  useCalloutList,
  useCancelCalloutEvent,
  useCreateCalloutEvent,
  useRecordAttempt,
  useScheduledShifts,
  useShiftTemplates,
  useClassifications,
} from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { NO_VALUE } from '@/lib/format'
import type { CalloutListEntry } from '@/api/callout'

const INITIAL_FORM = {
  scheduled_shift_id: NO_VALUE,
  classification_id: NO_VALUE,
  reason_text: '',
}

type AcceptTarget = { user_id: string; name: string }

export default function CalloutPage() {
  const { isManager } = usePermissions()
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [showInitiate, setShowInitiate] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [acceptTarget, setAcceptTarget] = useState<AcceptTarget | null>(null)
  const [acceptNotes, setAcceptNotes] = useState('')

  const today = format(new Date(), 'yyyy-MM-dd')
  const twoWeeksOut = format(addDays(new Date(), 14), 'yyyy-MM-dd')

  const { data: events, isLoading, isError } = useCalloutEvents()
  const { data: calloutList } = useCalloutList(selectedEvent ?? '')
  const cancelMut = useCancelCalloutEvent()
  const createMut = useCreateCalloutEvent()
  const recordMut = useRecordAttempt()

  const { data: scheduledShifts } = useScheduledShifts({ start_date: today, end_date: twoWeeksOut })
  const { data: templates } = useShiftTemplates()
  const { data: classifications } = useClassifications()

  const templateMap = Object.fromEntries((templates ?? []).map((t) => [t.id, t]))

  const selectedEventData = (events ?? []).find((e) => e.id === selectedEvent)
  const eventIsOpen = selectedEventData?.status === 'open'

  function handleInitiate() {
    if (form.scheduled_shift_id === NO_VALUE) return
    createMut.mutate(
      {
        scheduled_shift_id: form.scheduled_shift_id,
        classification_id: form.classification_id !== NO_VALUE ? form.classification_id : undefined,
        reason_text: form.reason_text || undefined,
      },
      {
        onSuccess: (ev) => {
          setShowInitiate(false)
          setForm(INITIAL_FORM)
          setSelectedEvent(ev.id)
        },
      },
    )
  }

  function recordResponse(userId: string, response: 'declined' | 'no_answer') {
    if (!selectedEvent) return
    recordMut.mutate({ eventId: selectedEvent, user_id: userId, response })
  }

  function handleAccept() {
    if (!acceptTarget || !selectedEvent) return
    recordMut.mutate(
      {
        eventId: selectedEvent,
        user_id: acceptTarget.user_id,
        response: 'accepted',
        notes: acceptNotes || undefined,
      },
      {
        onSuccess: () => {
          setAcceptTarget(null)
          setAcceptNotes('')
        },
      },
    )
  }

  const calloutColumns: Column<CalloutListEntry>[] = [
    { header: '#', cell: (r) => <span className="font-semibold">{r.position}</span> },
    {
      header: 'Name',
      cell: (r) => (
        <div>
          {r.last_name}, {r.first_name}
          {r.classification_abbreviation && (
            <span className="block text-xs text-muted-foreground">
              {r.classification_abbreviation}
            </span>
          )}
        </div>
      ),
    },
    { header: 'OT Hrs', cell: (r) => r.ot_hours.toFixed(1) },
    {
      header: 'Status',
      cell: (r) =>
        r.is_available ? (
          <span className="text-green-600 font-medium">Available</span>
        ) : (
          <span className="text-muted-foreground text-xs">{r.unavailable_reason}</span>
        ),
    },
    ...(isManager && eventIsOpen
      ? [{
          header: 'Contact',
          cell: (r: CalloutListEntry) => {
            const busy = recordMut.isPending && (recordMut.variables as { user_id: string } | undefined)?.user_id === r.user_id
            return (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 hover:bg-green-50"
                  disabled={recordMut.isPending}
                  onClick={() => setAcceptTarget({ user_id: r.user_id, name: `${r.last_name}, ${r.first_name}` })}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700 hover:bg-red-50"
                  disabled={recordMut.isPending}
                  onClick={() => recordResponse(r.user_id, 'declined')}
                >
                  {busy && (recordMut.variables as { response: string } | undefined)?.response === 'declined' ? '…' : 'Decline'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recordMut.isPending}
                  onClick={() => recordResponse(r.user_id, 'no_answer')}
                >
                  {busy && (recordMut.variables as { response: string } | undefined)?.response === 'no_answer' ? '…' : 'No Answer'}
                </Button>
              </div>
            )
          },
        }]
      : []),
  ]

  return (
    <div>
      <PageHeader
        title="Callout"
        actions={
          isManager ? (
            <Button onClick={() => setShowInitiate(true)}>+ Initiate Callout</Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events list */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Events</h3>
          {isLoading && <LoadingState />}
          {!isLoading && isError && (
            <p className="text-sm text-destructive">Failed to load callout events.</p>
          )}
          {!isLoading && !isError && (events ?? []).length === 0 && (
            <EmptyState title="No callout events" />
          )}
          <div className="space-y-2">
            {(events ?? []).map((ev) => (
              <div
                key={ev.id}
                onClick={() => setSelectedEvent(ev.id)}
                className={cn(
                  "border rounded-lg p-3 cursor-pointer transition-colors",
                  selectedEvent === ev.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {new Date(ev.created_at).toLocaleDateString()}
                  </span>
                  <StatusBadge status={ev.status} />
                </div>
                {(ev.shift_template_name || ev.team_name) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {[ev.team_name, ev.shift_template_name].filter(Boolean).join(' — ')}
                    {ev.shift_date && ` (${ev.shift_date})`}
                  </p>
                )}
                {ev.reason_text && (
                  <p className="text-xs text-muted-foreground mt-1">{ev.reason_text}</p>
                )}
                {isManager && ev.status === 'open' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      cancelMut.mutate(ev.id, {
                        onSuccess: () => setSelectedEvent(null),
                      })
                    }}
                  >
                    Cancel event
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Callout list */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {selectedEvent ? 'Callout List' : 'Select an event'}
          </h3>
          {calloutList && (
            <DataTable
              columns={calloutColumns}
              data={calloutList}
              rowKey={(r) => r.user_id}
              emptyMessage="No entries in callout list"
            />
          )}
        </div>
      </div>

      {/* Initiate callout dialog */}
      <Dialog open={showInitiate} onOpenChange={(open) => !open && setShowInitiate(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Callout</DialogTitle>
            <DialogDescription>
              Select the shift that needs coverage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FormField label="Shift" htmlFor="callout-shift" required>
              <Select
                value={form.scheduled_shift_id}
                onValueChange={(v) => setForm({ ...form, scheduled_shift_id: v })}
              >
                <SelectTrigger id="callout-shift">
                  <SelectValue placeholder="Select a shift…" />
                </SelectTrigger>
                <SelectContent>
                  {(scheduledShifts ?? []).map((s) => {
                    const tmpl = templateMap[s.shift_template_id]
                    const label = tmpl ? `${s.date} — ${tmpl.name}` : s.date
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Classification Filter" htmlFor="callout-class">
              <Select
                value={form.classification_id}
                onValueChange={(v) => setForm({ ...form, classification_id: v })}
              >
                <SelectTrigger id="callout-class">
                  <SelectValue placeholder="Any classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VALUE}>Any classification</SelectItem>
                  {(classifications ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Reason" htmlFor="callout-reason">
              <Textarea
                id="callout-reason"
                value={form.reason_text}
                onChange={(e) => setForm({ ...form, reason_text: e.target.value })}
                placeholder="Optional reason for the callout…"
                rows={3}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitiate(false)}>Cancel</Button>
            <Button
              onClick={handleInitiate}
              disabled={form.scheduled_shift_id === NO_VALUE || createMut.isPending}
            >
              Initiate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept confirmation dialog */}
      <Dialog open={!!acceptTarget} onOpenChange={(open) => !open && setAcceptTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Acceptance</DialogTitle>
            <DialogDescription>
              <strong>{acceptTarget?.name}</strong> has accepted the OT shift.
              This will mark the callout event as filled and create an OT assignment.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Notes" htmlFor="accept-notes">
            <Textarea
              id="accept-notes"
              value={acceptNotes}
              onChange={(e) => setAcceptNotes(e.target.value)}
              placeholder="Optional notes…"
              rows={2}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptTarget(null)}>Cancel</Button>
            <Button onClick={handleAccept} disabled={recordMut.isPending}>
              Confirm Acceptance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
