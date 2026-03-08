// frontend/src/components/ReviewerNotesPopover.tsx
import { MessageSquare } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

interface ReviewerNotesPopoverProps {
  notes: string
}

export function ReviewerNotesPopover({ notes }: ReviewerNotesPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Reviewer notes"
          aria-label="View reviewer notes"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 text-sm">
        <p className="font-medium text-xs text-muted-foreground mb-1">Reviewer Notes</p>
        <p className="whitespace-pre-wrap">{notes}</p>
      </PopoverContent>
    </Popover>
  )
}
