import { api } from './client'

export interface BargainingUnit {
  id: string
  code: string
  name: string
  is_active: boolean
}

export const bargainingUnitsApi = {
  list: () =>
    api.get<BargainingUnit[]>('/api/bargaining-units').then((r) => r.data),
}
