// frontend/src/pages/CalloutPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ----- Mutable mock state -----
const mockState = { role: 'employee', userId: 'user-1' }
const mockCalloutEvents = vi.fn()
const mockCalloutList = vi.fn()
const mockBumpRequests = vi.fn()
const mockCalloutVolunteers = vi.fn()
const mockUsePermissions = vi.fn()

vi.mock('@/hooks/queries', () => ({
  useCalloutEvents: (...args: unknown[]) => mockCalloutEvents(...args),
  useCalloutList: (...args: unknown[]) => mockCalloutList(...args),
  useCancelCalloutEvent: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateCalloutEvent: () => ({ mutate: vi.fn(), isPending: false }),
  useRecordAttempt: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useScheduledShifts: () => ({ data: [] }),
  useShiftTemplates: () => ({ data: [] }),
  useClassifications: () => ({ data: [] }),
  useCalloutVolunteers: (...args: unknown[]) => mockCalloutVolunteers(...args),
  useVolunteer: () => ({ mutate: vi.fn(), isPending: false }),
  useAdvanceCalloutStep: () => ({ mutate: vi.fn(), isPending: false }),
  useBumpRequests: (...args: unknown[]) => mockBumpRequests(...args),
  useCreateBumpRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useReviewBumpRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useOtRequests: () => ({ data: [] }),
}))

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (v: string) => v,
}))

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => mockUsePermissions(),
}))

vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (s: { user: { id: string; role: string } | null }) => unknown) =>
    selector({ user: { id: mockState.userId, role: mockState.role } }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Must import AFTER vi.mock declarations
const { default: CalloutPage } = await import('./CalloutPage')

function makePermissions(role: string) {
  return {
    role,
    isAdmin: role === 'admin',
    isSupervisor: role === 'supervisor',
    isManager: role === 'admin' || role === 'supervisor',
    canManageSchedule: role === 'admin' || role === 'supervisor',
    canApproveLeave: role === 'admin' || role === 'supervisor',
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = createQueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const filledEvent = {
  id: 'evt-1',
  scheduled_shift_id: 'ss-1',
  initiated_by: 'sup-1',
  ot_reason_id: null,
  reason_text: null,
  classification_id: 'cls-1',
  classification_name: 'Dispatcher',
  status: 'filled' as const,
  current_step: null,
  step_started_at: null,
  shift_template_name: 'Day Shift',
  shift_date: '2026-03-01',
  team_name: 'A Team',
  created_at: '2026-02-23T08:00:00Z',
  updated_at: '2026-02-23T08:00:00Z',
}

const pendingBump = {
  id: 'bump-1',
  event_id: 'evt-1',
  requesting_user_id: 'user-3',
  requesting_user_first_name: 'Charlie',
  requesting_user_last_name: 'Brown',
  displaced_user_id: 'user-2',
  displaced_user_first_name: 'Bob',
  displaced_user_last_name: 'Jones',
  status: 'pending' as const,
  reason: 'Higher priority',
  created_at: '2026-02-23T09:00:00Z',
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockState.role = 'employee'
  mockState.userId = 'user-1'
  mockUsePermissions.mockReturnValue(makePermissions('employee'))
  mockCalloutEvents.mockReturnValue({
    data: [filledEvent],
    isLoading: false,
    isError: false,
  })
  mockCalloutList.mockReturnValue({ data: [] })
  mockBumpRequests.mockReturnValue({ data: [] })
  mockCalloutVolunteers.mockReturnValue({ data: [] })
})

describe('CalloutPage bump request UI', () => {
  it('shows "Request Bump" button for employee when event is filled and selected', async () => {
    renderWithProviders(<CalloutPage />)

    const eventButtons = screen.getAllByRole('button', { name: /Callout event from/i })
    fireEvent.click(eventButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Request bump/i })).toBeInTheDocument()
    })
  })

  it('does not show "Request Bump" button for supervisor', async () => {
    mockState.role = 'supervisor'
    mockUsePermissions.mockReturnValue(makePermissions('supervisor'))

    renderWithProviders(<CalloutPage />)

    const eventButtons = screen.getAllByRole('button', { name: /Callout event from/i })
    fireEvent.click(eventButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Callout List')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Request bump/i })).not.toBeInTheDocument()
  })

  it('shows pending bump requests panel for supervisor', async () => {
    mockState.role = 'supervisor'
    mockUsePermissions.mockReturnValue(makePermissions('supervisor'))
    mockBumpRequests.mockReturnValue({ data: [pendingBump] })

    renderWithProviders(<CalloutPage />)

    const eventButtons = screen.getAllByRole('button', { name: /Callout event from/i })
    fireEvent.click(eventButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Pending Bump Requests (1)')).toBeInTheDocument()
    })
    expect(screen.getByText(/Charlie/)).toBeInTheDocument()
    expect(screen.getByText(/Brown/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Approve bump/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reject bump/i })).toBeInTheDocument()
  })

  it('does not show bump requests panel for employee', async () => {
    mockBumpRequests.mockReturnValue({ data: [pendingBump] })

    renderWithProviders(<CalloutPage />)

    const eventButtons = screen.getAllByRole('button', { name: /Callout event from/i })
    fireEvent.click(eventButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Request bump/i })).toBeInTheDocument()
    })

    expect(screen.queryByText('Pending Bump Requests (1)')).not.toBeInTheDocument()
  })
})
