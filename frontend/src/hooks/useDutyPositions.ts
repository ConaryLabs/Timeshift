import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dutyPositionsApi } from '@/api/dutyPositions'
import { queryKeys } from './queryKeys'

export function useDutyPositions() {
  return useQuery({
    queryKey: queryKeys.dutyPositions.all,
    queryFn: dutyPositionsApi.list,
  })
}

export function useCreateDutyPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyPositionsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dutyPositions.all }),
  })
}

export function useUpdateDutyPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; classification_id?: string | null; sort_order?: number; is_active?: boolean }) =>
      dutyPositionsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dutyPositions.all }),
  })
}

export function useDeleteDutyPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyPositionsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dutyPositions.all }),
  })
}

export function useDutyAssignments(date: string, shiftTemplateId?: string) {
  return useQuery({
    queryKey: queryKeys.dutyPositions.assignments(date, shiftTemplateId),
    queryFn: () => dutyPositionsApi.listAssignments({ date, shift_template_id: shiftTemplateId }),
    enabled: !!date,
  })
}

export function useCreateDutyAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyPositionsApi.createAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty-assignments'] }),
  })
}

export function useUpdateDutyAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; user_id?: string; notes?: string | null }) =>
      dutyPositionsApi.updateAssignment(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty-assignments'] }),
  })
}

export function useDeleteDutyAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dutyPositionsApi.deleteAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty-assignments'] }),
  })
}
