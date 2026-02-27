import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dutyBoardApi } from '@/api/dutyBoard'
import { dutyPositionsApi } from '@/api/dutyPositions'
import { queryKeys } from './queryKeys'

// Board state
export function useDutyBoard(date: string) {
  return useQuery({
    queryKey: queryKeys.dutyBoard.board(date),
    queryFn: () => dutyBoardApi.getBoard(date),
    enabled: !!date,
  })
}

// Cell action (assign / mark_ot / clear)
export function useCellAction(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      duty_position_id: string
      block_index: number
      action: 'assign' | 'mark_ot' | 'clear'
      user_id?: string
    }) => dutyBoardApi.cellAction(date, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dutyBoard.board(date) })
    },
  })
}

// Create a date-specific position (ad-hoc row on duty board)
export function useCreateDatePosition(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; classification_id?: string }) =>
      dutyPositionsApi.create({ ...body, board_date: date, sort_order: 9999 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dutyBoard.board(date) })
      qc.invalidateQueries({ queryKey: queryKeys.dutyPositions.all })
    },
  })
}

// Delete a date-specific position (remove ad-hoc row)
export function useDeleteDatePosition(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dutyPositionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dutyBoard.board(date) })
      qc.invalidateQueries({ queryKey: queryKeys.dutyPositions.all })
    },
  })
}

// Available staff for a cell
export function useAvailableStaff(date: string, blockIndex: number, positionId: string, enabled = false) {
  return useQuery({
    queryKey: queryKeys.dutyBoard.available(date, blockIndex, positionId),
    queryFn: () => dutyBoardApi.getAvailable(date, { block_index: blockIndex, duty_position_id: positionId }),
    enabled: enabled && !!date && !!positionId,
  })
}

// Console hours report
export function useConsoleHours(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.dutyBoard.consoleHours(startDate, endDate),
    queryFn: () => dutyBoardApi.getConsoleHours({ start_date: startDate, end_date: endDate }),
    enabled: enabled && !!startDate && !!endDate,
  })
}

// Qualifications
export function useQualifications() {
  return useQuery({
    queryKey: queryKeys.qualifications.all,
    queryFn: dutyBoardApi.listQualifications,
  })
}

export function useCreateQualification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyBoardApi.createQualification,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.qualifications.all }),
  })
}

export function useDeleteQualification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyBoardApi.deleteQualification,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.qualifications.all }),
  })
}

// Position qualifications
export function usePositionQualifications(positionId: string) {
  return useQuery({
    queryKey: queryKeys.qualifications.position(positionId),
    queryFn: () => dutyBoardApi.listPositionQualifications(positionId),
    enabled: !!positionId,
  })
}

export function useAddPositionQualification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ positionId, qualificationId }: { positionId: string; qualificationId: string }) =>
      dutyBoardApi.addPositionQualification(positionId, qualificationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qualifications'] }),
  })
}

export function useRemovePositionQualification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ positionId, qualificationId }: { positionId: string; qualificationId: string }) =>
      dutyBoardApi.removePositionQualification(positionId, qualificationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qualifications'] }),
  })
}

// User qualifications
export function useUserQualifications(userId: string) {
  return useQuery({
    queryKey: queryKeys.qualifications.user(userId),
    queryFn: () => dutyBoardApi.listUserQualifications(userId),
    enabled: !!userId,
  })
}

export function useAddUserQualification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, qualificationId }: { userId: string; qualificationId: string }) =>
      dutyBoardApi.addUserQualification(userId, qualificationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qualifications'] }),
  })
}

export function useRemoveUserQualification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, qualificationId }: { userId: string; qualificationId: string }) =>
      dutyBoardApi.removeUserQualification(userId, qualificationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qualifications'] }),
  })
}

// Position hours
export function useSetPositionHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ positionId, ...body }: {
      positionId: string
      day_of_week: number
      open_time: string
      close_time: string
      crosses_midnight?: boolean
    }) => dutyBoardApi.setPositionHours(positionId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duty-board'] })
      qc.invalidateQueries({ queryKey: queryKeys.dutyPositions.all })
    },
  })
}

export function useDeletePositionHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyBoardApi.deletePositionHours,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duty-board'] })
      qc.invalidateQueries({ queryKey: queryKeys.dutyPositions.all })
    },
  })
}
