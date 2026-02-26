import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { CalloutStep } from '@/api/ot'
import { CALLOUT_STEPS, STEP_DESCRIPTIONS } from './calloutSteps'

export function StepIndicator({ currentStep }: { currentStep: CalloutStep | null }) {
  const activeIndex = currentStep
    ? CALLOUT_STEPS.findIndex((s) => s.key === currentStep)
    : -1

  return (
    <div className="flex items-center gap-1 flex-wrap mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-sm">
            The callout process contacts employees in order: first volunteers, then by lowest OT hours, inverse seniority, equal OT hours, and finally mandatory assignment.
          </TooltipContent>
        </Tooltip>
      </div>
      {CALLOUT_STEPS.map((step, i) => {
        const isActive = i === activeIndex
        const isPast = i < activeIndex
        return (
          <div key={step.key} className="flex items-center gap-1">
            {i > 0 && <div className={cn("w-4 h-px", isPast ? "bg-primary" : "bg-border")} />}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={isActive ? 'default' : isPast ? 'secondary' : 'outline'}
                  className={cn(
                    "text-xs whitespace-nowrap",
                    isActive && "ring-2 ring-primary/30",
                  )}
                >
                  {i + 1}. {step.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {STEP_DESCRIPTIONS[step.key]}
              </TooltipContent>
            </Tooltip>
          </div>
        )
      })}
    </div>
  )
}
