// frontend/src/lib/format.ts
import { isAxiosError } from 'axios'

export function formatTime(time: string) {
  if (!time || !time.includes(':')) return time || ''
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  if (Number.isNaN(hour)) return time
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${m} ${ampm}`
}

export function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Compact date without weekday: "Jan 5" */
export function formatDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** Date with year: "Jan 5, 2024" */
export function formatDateFull(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDay(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
  })
}

export function extractApiError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    return err.response?.data?.error ?? fallback
  }
  return fallback
}

/** Format a Date as YYYY-MM-DD using local time (not UTC).
 *  Use this instead of `date.toISOString().slice(0, 10)` which returns UTC date
 *  and can be off by one day for users in negative UTC offsets. */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Format an ISO timestamp as a short date+time string, e.g. "Jan 5, 2:30 PM" */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Format an ISO timestamp with year, e.g. "Jan 5, 2026, 2:30 PM" */
export function formatDateTimeWithYear(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Returns a readable text color (dark or light) for a given hex background color */
export function contrastText(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#111'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#111' : '#fff'
}

/** Parse "HH:MM" or "HH:MM:SS" to total minutes since midnight. */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Add (or subtract) hours from a HH:MM or HH:MM:SS time string, wrapping at midnight. Returns "HH:MM:SS". */
export function addHoursToTime(time: string, hours: number): string {
  const totalMinutes = ((parseTimeToMinutes(time) + hours * 60) % 1440 + 1440) % 1440
  const newH = Math.floor(totalMinutes / 60)
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:00`
}

/** Date with long month and year: "January 5, 2024" */
export function formatDateLong(d: string | null): string {
  if (!d) return '\u2014'
  const date = new Date(d + 'T00:00:00')
  if (isNaN(date.getTime())) return '\u2014'
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Relative time description (e.g. "5m ago", "yesterday", "2w ago").
 *  Falls back to a short date for timestamps older than ~4 weeks. */
export function timeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  const dateOnly = dateStr.split('T')[0]
  return formatDateShort(dateOnly)
}

/** Sentinel value for Select dropdowns representing "no selection" / clear field */
export const NO_VALUE = '__none__'

/** Abbreviated day-of-week labels, indexed Sunday=0 through Saturday=6 */
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
