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
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#111' : '#fff'
}

/** Sentinel value for Select dropdowns representing "no selection" / clear field */
export const NO_VALUE = '__none__'
