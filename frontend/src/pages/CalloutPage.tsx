import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calloutApi, type CalloutEvent, type CalloutListEntry } from '../api/callout'
import { useAuthStore } from '../store/auth'

export default function CalloutPage() {
  const user = useAuthStore((s) => s.user)
  const isManager = user?.role === 'admin' || user?.role === 'supervisor'
  const qc = useQueryClient()
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)

  const { data: events, isLoading } = useQuery({
    queryKey: ['callout-events'],
    queryFn: calloutApi.listEvents,
  })

  const { data: calloutList } = useQuery({
    queryKey: ['callout-list', selectedEvent],
    queryFn: () => calloutApi.getList(selectedEvent!),
    enabled: !!selectedEvent,
  })

  const cancelMut = useMutation({
    mutationFn: calloutApi.cancelEvent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['callout-events'] }); setSelectedEvent(null) },
  })

  const STATUS_COLOR: Record<string, string> = {
    open: '#22c55e',
    filled: '#3b82f6',
    cancelled: '#94a3b8',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <div>
        <h2 style={{ marginTop: 0 }}>Callout Events</h2>
        {isLoading && <p>Loading…</p>}
        {(events ?? []).map((ev) => (
          <div
            key={ev.id}
            onClick={() => setSelectedEvent(ev.id)}
            style={{
              background: selectedEvent === ev.id ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${selectedEvent === ev.id ? '#3b82f6' : '#e2e8f0'}`,
              borderRadius: 8,
              padding: '0.75rem 1rem',
              marginBottom: '0.5rem',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {new Date(ev.created_at).toLocaleDateString()}
              </span>
              <span style={{ background: STATUS_COLOR[ev.status], color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem' }}>
                {ev.status}
              </span>
            </div>
            {ev.reason && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>{ev.reason}</p>}
            {isManager && ev.status === 'open' && (
              <button
                onClick={(e) => { e.stopPropagation(); cancelMut.mutate(ev.id) }}
                style={{ marginTop: '0.5rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Cancel event
              </button>
            )}
          </div>
        ))}
      </div>

      <div>
        <h2 style={{ marginTop: 0 }}>
          {selectedEvent ? 'Callout List' : 'Select an event'}
        </h2>
        {calloutList && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>#</th>
                <th style={{ padding: '0.5rem' }}>Name</th>
                <th style={{ padding: '0.5rem' }}>OT Hrs</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {calloutList.map((entry) => (
                <tr
                  key={entry.user_id}
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    opacity: entry.is_available ? 1 : 0.5,
                  }}
                >
                  <td style={{ padding: '0.5rem', fontWeight: 600 }}>{entry.position}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {entry.last_name}, {entry.first_name}
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{entry.position_title}</div>
                  </td>
                  <td style={{ padding: '0.5rem' }}>{entry.ot_hours.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {entry.is_available ? (
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>Available</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{entry.unavailable_reason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
