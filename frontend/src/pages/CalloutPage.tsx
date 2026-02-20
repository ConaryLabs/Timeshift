import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import { useCalloutEvents, useCalloutList, useCancelCalloutEvent } from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import type { CalloutListEntry } from '@/api/callout'

export default function CalloutPage() {
  const { isManager } = usePermissions()
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)

  const { data: events, isLoading, isError } = useCalloutEvents()
  const { data: calloutList } = useCalloutList(selectedEvent ?? '')
  const cancelMut = useCancelCalloutEvent()

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
  ]

  return (
    <div>
      <PageHeader title="Callout" />

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
    </div>
  )
}
