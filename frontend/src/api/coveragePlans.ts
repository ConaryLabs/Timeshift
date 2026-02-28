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

export interface ClassificationGap {
  classification_id: string
  classification_abbreviation: string
  shift_template_id: string
  shift_name: string
  shift_color: string
  target: number
  actual: number
  shortage: number
}

// -- Block-level gaps (contiguous time ranges per classification) --

export interface CoverageGapBlock {
  start_time: string
  end_time: string
  shortage: number
}

export interface ClassificationGapBlocks {
  classification_id: string
  classification_abbreviation: string
  blocks: CoverageGapBlock[]
}

// -- Day Grid types --

export interface BlockEmployee {
  user_id: string
  first_name: string
  last_name: string
  shift_name: string
  shift_start: string
  shift_end: string
  is_overtime: boolean
  assignment_id: string
}

export interface ClassificationBlock {
  block_index: number
  start_time: string
  end_time: string
  min: number
  target: number
  actual: number
  status: 'green' | 'yellow' | 'red'
  employees: BlockEmployee[]
}

export interface DayGridClassification {
  classification_id: string
  abbreviation: string
  blocks: ClassificationBlock[]
}

export interface CoverageBlock {
  block_index: number
  total_target: number
  total_actual: number
  status: 'green' | 'yellow' | 'red'
}

export interface DayGridResponse {
  date: string
  classifications: DayGridClassification[]
  blocks: CoverageBlock[]
}

export interface SmsAlertResult {
  sent: number
  failed: number
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

  getGaps: (date: string) =>
    api.get<ClassificationGap[]>(`/api/coverage-plans/gaps/${date}`).then((r) => r.data),

  getGapBlocks: (date: string) =>
    api.get<ClassificationGapBlocks[]>(`/api/coverage-plans/gaps/${date}/blocks`).then((r) => r.data),

  sendSmsAlert: (date: string, body?: { classification_id?: string }) =>
    api.post<SmsAlertResult>(`/api/coverage-plans/gaps/${date}/sms-alert`, body ?? {}).then((r) => r.data),

  dayGrid: (date: string) =>
    api.get<DayGridResponse>(`/api/coverage-plans/day-grid/${date}`).then((r) => r.data),
}
