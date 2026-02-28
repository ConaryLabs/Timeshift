import { apiClient } from './client'

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
    apiClient.get<CoveragePlanView[]>('/api/coverage-plans'),

  getPlan: (id: string) =>
    apiClient.get<CoveragePlan>(`/api/coverage-plans/${id}`),

  createPlan: (body: { name: string; description?: string; is_default?: boolean }) =>
    apiClient.post<CoveragePlan>('/api/coverage-plans', body),

  updatePlan: (id: string, body: { name?: string; description?: string; is_default?: boolean; is_active?: boolean }) =>
    apiClient.patch<CoveragePlan>(`/api/coverage-plans/${id}`, body),

  deletePlan: (id: string) =>
    apiClient.delete(`/api/coverage-plans/${id}`),

  listSlots: (planId: string, params?: { classification_id?: string; day_of_week?: number }) =>
    apiClient.get<CoveragePlanSlot[]>(`/api/coverage-plans/${planId}/slots`, { params }),

  bulkUpsertSlots: (planId: string, slots: SlotEntry[]) =>
    apiClient.post<CoveragePlanSlot[]>(`/api/coverage-plans/${planId}/slots/bulk`, { slots }),

  listAssignments: () =>
    apiClient.get<CoveragePlanAssignment[]>('/api/coverage-plans/assignments'),

  createAssignment: (body: { plan_id: string; start_date: string; end_date?: string | null; notes?: string | null }) =>
    apiClient.post<CoveragePlanAssignment>('/api/coverage-plans/assignments', body),

  deleteAssignment: (id: string) =>
    apiClient.delete(`/api/coverage-plans/assignments/${id}`),

  getResolved: (date: string) =>
    apiClient.get<SlotCoverage[]>(`/api/coverage-plans/resolved/${date}`),

  getGaps: (date: string) =>
    apiClient.get<ClassificationGap[]>(`/api/coverage-plans/gaps/${date}`),

  getGapBlocks: (date: string) =>
    apiClient.get<ClassificationGapBlocks[]>(`/api/coverage-plans/gaps/${date}/blocks`),

  sendSmsAlert: (date: string, body?: { classification_id?: string }) =>
    apiClient.post<SmsAlertResult>(`/api/coverage-plans/gaps/${date}/sms-alert`, body ?? {}),

  dayGrid: (date: string) =>
    apiClient.get<DayGridResponse>(`/api/coverage-plans/day-grid/${date}`),
}
