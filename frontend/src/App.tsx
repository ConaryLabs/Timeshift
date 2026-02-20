import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import RequireRole from '@/components/RequireRole'
import ErrorBoundary from '@/components/ErrorBoundary'
import LoginPage from '@/pages/LoginPage'
import SchedulePage from '@/pages/SchedulePage'
import LeavePage from '@/pages/LeavePage'
import CalloutPage from '@/pages/CalloutPage'
import AppShell from '@/components/layout/AppShell'

// Admin pages (placeholder components until Phase 2)
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <p className="text-lg">{title} — coming soon</p>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          {/* Core pages */}
          <Route index element={<Navigate to="/schedule" replace />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route
            path="callout"
            element={
              <RequireRole roles={['admin', 'supervisor']}>
                <CalloutPage />
              </RequireRole>
            }
          />

          {/* Admin routes */}
          <Route path="admin">
            <Route
              path="classifications"
              element={
                <RequireRole roles="admin">
                  <PlaceholderPage title="Classifications" />
                </RequireRole>
              }
            />
            <Route
              path="shift-templates"
              element={
                <RequireRole roles="admin">
                  <PlaceholderPage title="Shift Templates" />
                </RequireRole>
              }
            />
            <Route
              path="teams"
              element={
                <RequireRole roles={['admin', 'supervisor']}>
                  <PlaceholderPage title="Teams" />
                </RequireRole>
              }
            />
            <Route
              path="teams/:id"
              element={
                <RequireRole roles={['admin', 'supervisor']}>
                  <PlaceholderPage title="Team Detail" />
                </RequireRole>
              }
            />
            <Route
              path="users"
              element={
                <RequireRole roles="admin">
                  <PlaceholderPage title="Users" />
                </RequireRole>
              }
            />
            <Route
              path="settings"
              element={
                <RequireRole roles="admin">
                  <PlaceholderPage title="Organization Settings" />
                </RequireRole>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/schedule" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
