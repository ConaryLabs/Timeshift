import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

const NAV = [
  { to: '/schedule', label: 'Schedule' },
  { to: '/leave',    label: 'Leave' },
  { to: '/callout',  label: 'Callout' },
]

export default function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{ background: '#1e3a5f', color: '#fff', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <span style={{ fontWeight: 700, fontSize: '1.2rem', padding: '0.75rem 0' }}>Timeshift</span>
        <nav style={{ display: 'flex', gap: '1rem', flex: 1 }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              style={({ isActive }) => ({
                color: isActive ? '#7dd3fc' : '#cbd5e1',
                textDecoration: 'none',
                padding: '0.75rem 0',
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive ? '2px solid #7dd3fc' : '2px solid transparent',
              })}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
          {user?.first_name} {user?.last_name}
        </span>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: '1px solid #475569', color: '#cbd5e1', padding: '0.25rem 0.75rem', borderRadius: 4, cursor: 'pointer' }}
        >
          Log out
        </button>
      </header>
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <Outlet />
      </main>
    </div>
  )
}
