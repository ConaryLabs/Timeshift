// frontend/src/pages/schedule/AssignmentChip.tsx
import { StickyNote } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { contrastText as contrastTextHex } from '@/lib/format'

export interface AssignmentChipProps {
  firstName: string
  lastName: string
  shiftColor: string
  classificationAbbreviation?: string | null
  isOvertime?: boolean
  isTrade?: boolean
  crossesMidnight?: boolean
  notes?: string | null
  position?: string | null
  teamName?: string | null
  compact?: boolean
  highlighted?: boolean
  className?: string
}

function contrastTextClass(hex: string): string {
  return contrastTextHex(hex) === '#111' ? 'text-gray-900' : 'text-white'
}

export function AssignmentChip({
  firstName,
  lastName,
  shiftColor,
  classificationAbbreviation,
  isOvertime,
  isTrade,
  crossesMidnight,
  notes,
  position,
  teamName,
  compact,
  highlighted,
  className,
}: AssignmentChipProps) {
  const textClass = contrastTextClass(shiftColor)

  const tooltipParts = [
    `${firstName} ${lastName}`,
    classificationAbbreviation,
    position,
    teamName,
    isOvertime ? 'OT' : null,
    isTrade ? 'Trade' : null,
    crossesMidnight ? 'Crosses midnight' : null,
    notes,
  ].filter(Boolean)

  const chipContent = (
    <>
      <span className="truncate">
        {compact ? lastName : `${lastName}, ${firstName?.[0] ?? ''}`}
        {classificationAbbreviation && (
          <span className="opacity-70 ml-1 text-[10px]">{classificationAbbreviation}</span>
        )}
      </span>
      {isOvertime && (
        <Badge
          variant="outline"
          className="shrink-0 h-3.5 px-0.5 text-[9px] font-bold border-current opacity-90 leading-none"
        >
          OT
        </Badge>
      )}
      {isTrade && <span className="shrink-0 opacity-80 text-[10px]">↔</span>}
      {crossesMidnight && <span className="shrink-0 opacity-80 text-[10px]">→</span>}
      {notes && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex shrink-0 cursor-default" aria-label="View notes">
              <StickyNote className="h-3 w-3 opacity-70" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {notes}
          </TooltipContent>
        </Tooltip>
      )}
    </>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-xs mb-0.5 inline-flex items-center gap-1 transition-shadow',
            textClass,
            highlighted && 'ring-2 ring-primary',
            className,
          )}
          style={{ backgroundColor: shiftColor }}
        >
          {chipContent}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipParts.join(' · ')}
      </TooltipContent>
    </Tooltip>
  )
}
