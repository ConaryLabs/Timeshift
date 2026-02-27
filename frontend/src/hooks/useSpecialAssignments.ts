import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { specialAssignmentsApi, type SpecialAssignmentListParams } from '@/api/specialAssignments'
import { queryKeys } from './queryKeys'

export function useSpecialAssignments(params?: SpecialAssignmentListParams) {
  return useQuery({
    queryKey: queryKeys.specialAssignments.list(params),
    queryFn: () => specialAssignmentsApi.list(params),
  })
}

export function useCreateSpecialAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: specialAssignmentsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.specialAssignments.all })
    },
  })
}

export function useUpdateSpecialAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; assignment_type?: string; end_date?: string | null; notes?: string | null }) =>
      specialAssignmentsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.specialAssignments.all })
    },
  })
}

export function useDeleteSpecialAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: specialAssignmentsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.specialAssignments.all })
    },
  })
}
