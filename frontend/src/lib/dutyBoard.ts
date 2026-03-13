// frontend/src/lib/dutyBoard.ts
import type { BoardAssignment } from '@/api/dutyBoard'

/** Map position name to its row label color from the original seating chart */
export function getPositionColor(name: string): { bg: string; text: string } {
  const upper = name.toUpperCase()
  if (upper.startsWith('FIRE'))
    return { bg: '#C00000', text: '#ffffff' }
  if (['DATA', 'AUBURN', 'FED WAY', 'KENT', 'RENTON'].includes(upper))
    return { bg: '#2F75B5', text: '#ffffff' }
  if (upper.includes('BREAK'))
    return { bg: '#548235', text: '#ffffff' }
  if (upper === 'ACCESS')
    return { bg: '#F4B084', text: '#000000' }
  if (upper.startsWith('CR'))
    return { bg: '#F4B084', text: '#000000' }
  return { bg: '#2F75B5', text: '#ffffff' }
}

export const BLOCK_LABELS = [
  '0000', '0200', '0400', '0600', '0800', '1000',
  '1200', '1400', '1600', '1800', '2000', '2200',
]

export function getCurrentBlockIndex(now: Date = new Date()): number {
  return Math.floor((now.getHours() * 60 + now.getMinutes()) / 120)
}

export function buildAssignmentMap(assignments: BoardAssignment[] | undefined): Map<string, BoardAssignment> {
  const map = new Map<string, BoardAssignment>()
  if (assignments) {
    for (const a of assignments) {
      map.set(`${a.duty_position_id}:${a.block_index}`, a)
    }
  }
  return map
}
