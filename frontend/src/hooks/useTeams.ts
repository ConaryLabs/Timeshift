// frontend/src/hooks/useTeams.ts
import { useQuery } from '@tanstack/react-query'
import { teamsApi } from '@/api/teams'
import { queryKeys } from './queryKeys'
import { useInvalidatingMutation } from './useInvalidatingMutation'

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams.all,
    queryFn: teamsApi.list,
  })
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: queryKeys.teams.detail(id),
    queryFn: () => teamsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateTeam() {
  return useInvalidatingMutation(teamsApi.create, [queryKeys.teams.all])
}

export function useUpdateTeam() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; name?: string; supervisor_id?: string | null; parent_team_id?: string | null; is_active?: boolean; expected_updated_at?: string }) =>
      teamsApi.update(id, body),
    [queryKeys.teams.all],
  )
}

export function useTeamSlots(teamId: string) {
  return useQuery({
    queryKey: queryKeys.teams.slots(teamId),
    queryFn: () => teamsApi.listSlots(teamId),
    enabled: !!teamId,
  })
}

export function useCreateSlot() {
  return useInvalidatingMutation(
    ({ teamId, ...body }: {
      teamId: string
      shift_template_id: string
      classification_id: string
      days_of_week: number[]
      label?: string
    }) => teamsApi.createSlot(teamId, body),
    [queryKeys.teams.all],
  )
}

export function useUpdateSlot() {
  return useInvalidatingMutation(
    ({ slotId, shift_template_id, classification_id, days_of_week, label, is_active }: {
      slotId: string
      teamId: string
      shift_template_id?: string
      classification_id?: string
      days_of_week?: number[]
      label?: string
      is_active?: boolean
    }) => teamsApi.updateSlot(slotId, { shift_template_id, classification_id, days_of_week, label, is_active }),
    [queryKeys.teams.all],
  )
}
