// frontend/src/api/bargainingUnits.ts
import { apiClient } from './client'

export interface BargainingUnit {
  id: string
  code: string
  name: string
  is_active: boolean
}

export const bargainingUnitsApi = {
  list: () =>
    apiClient.get<BargainingUnit[]>('/api/bargaining-units'),
}
