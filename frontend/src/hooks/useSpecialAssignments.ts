import { useQuery } from '@tanstack/react-query'
import { specialAssignmentsApi, type SpecialAssignmentListParams } from '@/api/specialAssignments'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useSpecialAssignments(params?: SpecialAssignmentListParams) {
  return useQuery({
    queryKey: queryKeys.specialAssignments.list(params),
    queryFn: () => specialAssignmentsApi.list(params),
  })
}

export function useCreateSpecialAssignment() {
  return useInvalidatingMutation(specialAssignmentsApi.create, [queryKeys.specialAssignments.all])
}

export function useUpdateSpecialAssignment() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; assignment_type?: string; end_date?: string | null; notes?: string | null }) =>
      specialAssignmentsApi.update(id, body),
    [queryKeys.specialAssignments.all],
  )
}

export function useDeleteSpecialAssignment() {
  return useInvalidatingMutation(specialAssignmentsApi.delete, [queryKeys.specialAssignments.all])
}
