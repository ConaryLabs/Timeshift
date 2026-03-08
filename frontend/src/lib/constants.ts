// frontend/src/lib/constants.ts
import type { EmployeeType, EmployeeStatus } from '@/store/auth'

export const EMPLOYEE_TYPES: { value: EmployeeType; label: string }[] = [
  { value: 'regular_full_time', label: 'Regular Full Time' },
  { value: 'job_share', label: 'Job Share' },
  { value: 'medical_part_time', label: 'Medical Part Time' },
  { value: 'temp_part_time', label: 'Temp Part Time' },
]

export const EMPLOYEE_STATUSES: { value: EmployeeStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'unpaid_loa', label: 'Unpaid LOA' },
  { value: 'lwop', label: 'LWOP' },
  { value: 'layoff', label: 'Layoff' },
  { value: 'separated', label: 'Separated' },
]
