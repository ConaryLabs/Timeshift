import { useQuery } from '@tanstack/react-query'
import { navApi } from '@/api/nav'
import { queryKeys } from './queryKeys'

export function useNavBadges() {
  return useQuery({
    queryKey: queryKeys.nav.badges,
    queryFn: navApi.badges,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })
}
