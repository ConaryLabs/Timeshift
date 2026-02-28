import type { BoardAssignment } from '@/api/dutyBoard'

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
