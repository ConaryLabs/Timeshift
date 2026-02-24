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

export function formatDay(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
  })
}

export function extractApiError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
}

/** Sentinel value for Select dropdowns representing "no selection" / clear field */
export const NO_VALUE = '__none__'
