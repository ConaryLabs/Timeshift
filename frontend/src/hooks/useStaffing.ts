// frontend/src/hooks/useStaffing.ts
import { useQuery } from '@tanstack/react-query'
import { staffingApi } from '@/api/staffing'
import { queryKeys } from './queryKeys'

export function useStaffingAvailable(date: string, shiftTemplateId: string, classificationId?: string) {
  return useQuery({
    queryKey: queryKeys.staffing.available(date, shiftTemplateId, classificationId),
    queryFn: () => staffingApi.getAvailable({ date, shift_template_id: shiftTemplateId, classification_id: classificationId }),
    enabled: !!date && !!shiftTemplateId,
    staleTime: 15_000,
  })
}

export function useBlockAvailable(date: string, classificationId: string, blockStart: string, blockEnd: string) {
  return useQuery({
    queryKey: queryKeys.staffing.blockAvailable(date, classificationId, blockStart, blockEnd),
    queryFn: () => staffingApi.blockAvailable({ date, classification_id: classificationId, block_start: blockStart, block_end: blockEnd }),
    enabled: !!date && !!classificationId && !!blockStart && !!blockEnd,
    staleTime: 15_000,
  })
}

export function useMandatoryOtOrder(classificationId: string) {
  return useQuery({
    queryKey: queryKeys.staffing.mandatoryOtOrder(classificationId),
    queryFn: () => staffingApi.mandatoryOtOrder({ classification_id: classificationId }),
    enabled: !!classificationId,
    staleTime: 30_000,
  })
}
