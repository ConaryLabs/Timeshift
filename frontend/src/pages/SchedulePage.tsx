import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, addDays } from 'date-fns'
import { scheduleApi, type AssignmentView } from '../api/schedule'

function getWeekRange(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 0 })
  const end = addDays(start, 6)
  return { start, end }
}

export default function SchedulePage() {
  const [anchor, setAnchor] = useState(() => new Date())
  const { start, end } = getWeekRange(anchor)

  const { data, isLoading, error } = useQuery({
    queryKey: ['schedule', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: () =>
      scheduleApi.getStaffing(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')),
  })

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  function byDate(date: Date) {
    const key = format(date, 'yyyy-MM-dd')
    return (data ?? []).filter((a) => a.date === key)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Schedule</h2>
        <button onClick={() => setAnchor((d) => addDays(d, -7))}>&larr; Prev</button>
        <span style={{ fontWeight: 600 }}>
          {format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}
        </span>
        <button onClick={() => setAnchor((d) => addDays(d, 7))}>Next &rarr;</button>
        <button onClick={() => setAnchor(new Date())}>Today</button>
      </div>

      {isLoading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>Failed to load schedule</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {days.map((day) => (
          <div key={day.toISOString()} style={{ background: '#f8fafc', borderRadius: 6, padding: 8, minHeight: 120 }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 6, color: '#64748b' }}>
              {format(day, 'EEE')}<br />
              <span style={{ fontSize: '1.1rem', color: '#1e293b' }}>{format(day, 'd')}</span>
            </div>
            {byDate(day).map((a) => (
              <AssignmentChip key={a.assignment_id} assignment={a} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function AssignmentChip({ assignment: a }: { assignment: AssignmentView }) {
  return (
    <div
      title={`${a.first_name} ${a.last_name} — ${a.position}${a.is_overtime ? ' (OT)' : ''}`}
      style={{
        background: a.shift_color,
        color: '#fff',
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: '0.75rem',
        marginBottom: 4,
        cursor: 'default',
        borderLeft: a.is_overtime ? '3px solid #fbbf24' : 'none',
      }}
    >
      {a.last_name}, {a.first_name[0]}
      <span style={{ opacity: 0.75, marginLeft: 4 }}>{a.shift_name}</span>
    </div>
  )
}
