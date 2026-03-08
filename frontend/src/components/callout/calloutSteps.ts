// components/callout/calloutSteps.ts
import type { CalloutStep } from '@/api/ot'

export const CALLOUT_STEPS: { key: CalloutStep; label: string }[] = [
  { key: 'volunteers', label: 'Volunteers' },
  { key: 'low_ot_hours', label: 'Low OT Hours' },
  { key: 'inverse_seniority', label: 'Inverse Seniority' },
  { key: 'equal_ot_hours', label: 'Equal OT Hours' },
  { key: 'mandatory', label: 'Mandatory' },
]

export const STEP_DESCRIPTIONS: Record<string, string> = {
  volunteers: 'Employees who volunteered for this shift',
  low_ot_hours: 'Employees sorted by lowest overtime hours first',
  inverse_seniority: 'Least senior employees contacted first',
  equal_ot_hours: 'Employees with equal OT hours, sorted by seniority',
  mandatory: 'Mandatory overtime assignment for remaining employees',
}

/** Return the next callout step after the current one, or null if at the end. */
export function getNextStep(currentStep: CalloutStep | null): CalloutStep | null {
  if (!currentStep) return 'volunteers'
  const idx = CALLOUT_STEPS.findIndex((s) => s.key === currentStep)
  if (idx < CALLOUT_STEPS.length - 1) return CALLOUT_STEPS[idx + 1].key
  return null
}

/** Return the previous callout step before the current one, or null if at the start. */
export function getPrevStep(currentStep: CalloutStep | null): CalloutStep | null {
  if (!currentStep) return null
  const idx = CALLOUT_STEPS.findIndex((s) => s.key === currentStep)
  if (idx > 0) return CALLOUT_STEPS[idx - 1].key
  return null
}
