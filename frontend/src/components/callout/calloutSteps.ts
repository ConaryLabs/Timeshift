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
