import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calloutApi } from './callout'
import { api } from './client'

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}))

const mockApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('calloutApi.createBumpRequest', () => {
  it('sends POST to correct endpoint with payload', async () => {
    const mockResponse = {
      id: 'bump-1',
      event_id: 'evt-1',
      requesting_user_id: 'user-1',
      requesting_user_first_name: 'Alice',
      requesting_user_last_name: 'Smith',
      displaced_user_id: 'user-2',
      displaced_user_first_name: 'Bob',
      displaced_user_last_name: 'Jones',
      status: 'pending',
      reason: 'Higher priority',
      created_at: '2026-02-23T00:00:00Z',
    }
    mockApi.post.mockResolvedValue({ data: mockResponse })

    const result = await calloutApi.createBumpRequest('evt-1', {
      displaced_user_id: 'user-2',
      reason: 'Higher priority',
    })

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/callout/events/evt-1/bump',
      { displaced_user_id: 'user-2', reason: 'Higher priority' },
    )
    expect(result).toEqual(mockResponse)
  })
})

describe('calloutApi.reviewBumpRequest', () => {
  it('sends PATCH to correct endpoint with approved=true', async () => {
    const mockResponse = {
      id: 'bump-1',
      event_id: 'evt-1',
      requesting_user_id: 'user-1',
      requesting_user_first_name: 'Alice',
      requesting_user_last_name: 'Smith',
      displaced_user_id: 'user-2',
      displaced_user_first_name: 'Bob',
      displaced_user_last_name: 'Jones',
      status: 'approved',
      reason: null,
      created_at: '2026-02-23T00:00:00Z',
      reviewed_at: '2026-02-23T01:00:00Z',
      reviewed_by: 'supervisor-1',
    }
    mockApi.patch.mockResolvedValue({ data: mockResponse })

    const result = await calloutApi.reviewBumpRequest('bump-1', { approved: true })

    expect(mockApi.patch).toHaveBeenCalledWith(
      '/api/callout/bump-requests/bump-1/review',
      { approved: true },
    )
    expect(result).toEqual(mockResponse)
  })

  it('sends PATCH with approved=false and reason', async () => {
    const mockResponse = {
      id: 'bump-1',
      status: 'denied',
    }
    mockApi.patch.mockResolvedValue({ data: mockResponse })

    const result = await calloutApi.reviewBumpRequest('bump-1', {
      approved: false,
      reason: 'Insufficient priority',
    })

    expect(mockApi.patch).toHaveBeenCalledWith(
      '/api/callout/bump-requests/bump-1/review',
      { approved: false, reason: 'Insufficient priority' },
    )
    expect(result).toEqual(mockResponse)
  })
})

describe('calloutApi.listBumpRequests', () => {
  it('sends GET to correct endpoint', async () => {
    const mockResponse = [
      {
        id: 'bump-1',
        event_id: 'evt-1',
        requesting_user_id: 'user-1',
        requesting_user_first_name: 'Alice',
        requesting_user_last_name: 'Smith',
        displaced_user_id: 'user-2',
        displaced_user_first_name: 'Bob',
        displaced_user_last_name: 'Jones',
        status: 'pending',
        reason: null,
        created_at: '2026-02-23T00:00:00Z',
      },
    ]
    mockApi.get.mockResolvedValue({ data: mockResponse })

    const result = await calloutApi.listBumpRequests('evt-1')

    expect(mockApi.get).toHaveBeenCalledWith('/api/callout/events/evt-1/bump-requests')
    expect(result).toEqual(mockResponse)
  })
})
