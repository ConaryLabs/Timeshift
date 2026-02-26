import { Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Column } from '@/components/ui/data-table'
import type { CalloutListEntry } from '@/api/callout'
import type { UseMutationResult } from '@tanstack/react-query'

interface UseCalloutColumnsOptions {
  isManager: boolean
  eventIsOpen: boolean
  recordMut: UseMutationResult<unknown, unknown, { eventId: string; user_id: string; response: string; notes?: string }>
  onAccept: (entry: CalloutListEntry) => void
  onDecline: (userId: string) => void
  onNoAnswer: (userId: string) => void
}

export function useCalloutColumns({
  isManager,
  eventIsOpen,
  recordMut,
  onAccept,
  onDecline,
  onNoAnswer,
}: UseCalloutColumnsOptions): Column<CalloutListEntry>[] {
  return [
    { header: '#', cell: (r) => <span className="font-semibold">{r.position}</span> },
    {
      header: 'Name',
      cell: (r) => (
        <div>
          {r.last_name}, {r.first_name}
          <span className="block text-xs text-muted-foreground">
            {r.classification_abbreviation}
            {r.is_cross_class && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 text-amber-700 border-amber-300">
                    cross-class
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  This employee is from a different classification and is eligible for cross-classification overtime (within the org's configured window).
                </TooltipContent>
              </Tooltip>
            )}
          </span>
        </div>
      ),
    },
    {
      header: 'Phone',
      cell: (r) =>
        r.phone ? (
          <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {r.phone}
          </a>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
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
                  aria-label={`Accept OT for ${r.first_name} ${r.last_name}`}
                  onClick={() => onAccept(r)}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700 hover:bg-red-50"
                  disabled={recordMut.isPending}
                  aria-label={`Record declined for ${r.first_name} ${r.last_name}`}
                  onClick={() => onDecline(r.user_id)}
                >
                  {busy && (recordMut.variables as { response: string } | undefined)?.response === 'declined' ? '...' : 'Decline'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recordMut.isPending}
                  aria-label={`Record no answer for ${r.first_name} ${r.last_name}`}
                  onClick={() => onNoAnswer(r.user_id)}
                >
                  {busy && (recordMut.variables as { response: string } | undefined)?.response === 'no_answer' ? '...' : 'No Answer'}
                </Button>
              </div>
            )
          },
        }]
      : []),
  ]
}
