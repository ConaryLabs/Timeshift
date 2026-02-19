import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leaveApi, type LeaveRequest, type LeaveType } from '../api/leave'
import { useAuthStore } from '../store/auth'

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  personal_day: 'Personal Day',
  bereavement: 'Bereavement',
  fmla: 'FMLA',
  military_leave: 'Military Leave',
  other: 'Other',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
  denied: '#ef4444',
  cancelled: '#94a3b8',
}

export default function LeavePage() {
  const user = useAuthStore((s) => s.user)
  const isManager = user?.role === 'admin' || user?.role === 'supervisor'
  const qc = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ leave_type: 'vacation' as LeaveType, start_date: '', end_date: '', reason: '' })

  const { data, isLoading } = useQuery({ queryKey: ['leave'], queryFn: leaveApi.list })

  const createMut = useMutation({
    mutationFn: leaveApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave'] }); setShowForm(false) },
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'denied' }) =>
      leaveApi.review(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave'] }),
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Leave Requests</h2>
        {!isManager && (
          <button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ Request Leave'}
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMut.mutate(form) }}
          style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <label>
            Type
            <select value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value as LeaveType })} style={{ display: 'block' }}>
              {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>
            Start
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required style={{ display: 'block' }} />
          </label>
          <label>
            End
            <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required style={{ display: 'block' }} />
          </label>
          <label>
            Reason (optional)
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} style={{ display: 'block' }} />
          </label>
          <button type="submit" disabled={createMut.isPending}>Submit</button>
        </form>
      )}

      {isLoading && <p>Loading…</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            {isManager && <th style={{ padding: '0.5rem' }}>Employee</th>}
            <th style={{ padding: '0.5rem' }}>Type</th>
            <th style={{ padding: '0.5rem' }}>Start</th>
            <th style={{ padding: '0.5rem' }}>End</th>
            <th style={{ padding: '0.5rem' }}>Status</th>
            {isManager && <th style={{ padding: '0.5rem' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((req) => (
            <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              {isManager && <td style={{ padding: '0.5rem' }}>{req.user_id}</td>}
              <td style={{ padding: '0.5rem' }}>{LEAVE_TYPE_LABELS[req.leave_type]}</td>
              <td style={{ padding: '0.5rem' }}>{req.start_date}</td>
              <td style={{ padding: '0.5rem' }}>{req.end_date}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ background: STATUS_COLORS[req.status], color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: '0.8rem' }}>
                  {req.status}
                </span>
              </td>
              {isManager && req.status === 'pending' && (
                <td style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => reviewMut.mutate({ id: req.id, status: 'approved' })} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer' }}>Approve</button>
                  <button onClick={() => reviewMut.mutate({ id: req.id, status: 'denied' })} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer' }}>Deny</button>
                </td>
              )}
              {isManager && req.status !== 'pending' && <td style={{ padding: '0.5rem' }} />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
