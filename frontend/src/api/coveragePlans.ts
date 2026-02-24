import { api } from './client'

export interface CoveragePlan {
  id: string
  org_id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface CoveragePlanView extends CoveragePlan {
  slot_count: number
  assignment_count: number
}

export interface CoveragePlanSlot {
  id: string
  plan_id: string
  classification_id: string
  day_of_week: number
  slot_index: number
  min_headcount: number
  target_headcount: number
  max_headcount: number
}

export interface SlotEntry {
  classification_id: string
  day_of_week: number
  slot_index: number
  min_headcount: number
  target_headcount: number
  max_headcount: number
}

export interface CoveragePlanAssignment {
  id: string
  org_id: string
  plan_id: string
  start_date: string
  end_date: string | null
  notes: string | null
  created_by: string
  created_at: string
}

export interface SlotCoverage {
  slot_index: number
  classification_id: string
  classification_abbreviation: string
  min_headcount: number
  target_headcount: number
  max_headcount: number
  actual_headcount: number
  status: 'green' | 'yellow' | 'red'
}

export const coveragePlansApi = {
  listPlans: () =>
    api.get<CoveragePlanView[]>('/api/coverage-plans').then((r) => r.data),

  getPlan: (id: string) =>
    api.get<CoveragePlan>(`/api/coverage-plans/${id}`).then((r) => r.data),

  createPlan: (body: { name: string; description?: string; is_default?: boolean }) =>
    api.post<CoveragePlan>('/api/coverage-plans', body).then((r) => r.data),

  updatePlan: (id: string, body: { name?: string; description?: string; is_default?: boolean; is_active?: boolean }) =>
    api.patch<CoveragePlan>(`/api/coverage-plans/${id}`, body).then((r) => r.data),

  deletePlan: (id: string) =>
    api.delete(`/api/coverage-plans/${id}`).then((r) => r.data),

  listSlots: (planId: string, params?: { classification_id?: string; day_of_week?: number }) =>
    api.get<CoveragePlanSlot[]>(`/api/coverage-plans/${planId}/slots`, { params }).then((r) => r.data),

  bulkUpsertSlots: (planId: string, slots: SlotEntry[]) =>
    api.post<CoveragePlanSlot[]>(`/api/coverage-plans/${planId}/slots/bulk`, { slots }).then((r) => r.data),

  listAssignments: () =>
    api.get<CoveragePlanAssignment[]>('/api/coverage-plans/assignments').then((r) => r.data),

  createAssignment: (body: { plan_id: string; start_date: string; end_date?: string | null; notes?: string | null }) =>
    api.post<CoveragePlanAssignment>('/api/coverage-plans/assignments', body).then((r) => r.data),

  deleteAssignment: (id: string) =>
    api.delete(`/api/coverage-plans/assignments/${id}`).then((r) => r.data),

  getResolved: (date: string) =>
    api.get<SlotCoverage[]>(`/api/coverage-plans/resolved/${date}`).then((r) => r.data),
}
