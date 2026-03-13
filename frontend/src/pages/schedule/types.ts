// frontend/src/pages/schedule/types.ts

export type CalendarView = 'day' | 'week' | 'month'

export const BLOCK_COUNT = 12
export const BLOCK_HOURS = 2

/** 2-hour block labels for display: "00:00", "02:00", ..., "22:00" */
export const BLOCK_TIME_LABELS = Array.from({ length: BLOCK_COUNT }, (_, i) => {
  const h = i * BLOCK_HOURS
  return `${String(h).padStart(2, '0')}:00`
})

/** Format a block index as a time range: "06:00–08:00" */
export function blockRangeLabel(blockIndex: number): string {
  const start = blockIndex * BLOCK_HOURS
  const end = start + BLOCK_HOURS
  const fmt = (h: number) => `${String(h % 24).padStart(2, '0')}:00`
  return `${fmt(start)}–${fmt(end)}`
}

/** Coverage status color classes for Tailwind */
export const STATUS_COLORS = {
  red: {
    bg: 'bg-red-100',
    bgDark: 'bg-red-200',
    text: 'text-red-800',
    border: 'border-red-300',
    ring: 'ring-red-400',
  },
  yellow: {
    bg: 'bg-yellow-100',
    bgDark: 'bg-yellow-200',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    ring: 'ring-yellow-400',
  },
  green: {
    bg: 'bg-green-100',
    bgDark: 'bg-green-200',
    text: 'text-green-800',
    border: 'border-green-300',
    ring: 'ring-green-400',
  },
} as const

export type CoverageStatus = keyof typeof STATUS_COLORS

/** Get intensity class for gap severity (darker red for larger gaps) */
export function gapIntensityClass(shortage: number): string {
  if (shortage <= 0) return STATUS_COLORS.green.bg
  if (shortage === 1) return 'bg-red-100'
  if (shortage === 2) return 'bg-red-200'
  return 'bg-red-300' // 3+
}

/** Selected block state for action panel.
 *  Field names match existing StaffingResolvePage convention. */
export interface SelectedBlock {
  classificationId: string
  classificationAbbr: string
  blockIndex: number
  blockStart: string  // "06:00"
  blockEnd: string    // "08:00"
  min: number
  actual: number
  // Derived: shortage = Math.max(0, min - actual)
}

/**
 * Derive coverage status from actual vs required numbers.
 * GridCell from the schedule API does NOT have a coverage_status field — use this.
 * ClassificationBlock from coveragePlans API DOES have a status field — prefer that when available.
 */
export function deriveCoverageStatus(actual: number, required: number): CoverageStatus {
  if (actual < required) return 'red'
  if (actual === required) return 'yellow'
  return 'green'
}
