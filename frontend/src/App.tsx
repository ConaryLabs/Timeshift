import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import RequireRole from '@/components/RequireRole'
import ErrorBoundary from '@/components/ErrorBoundary'
import LoginPage from '@/pages/LoginPage'
import SchedulePage from '@/pages/SchedulePage'
import LeavePage from '@/pages/LeavePage'
import CalloutPage from '@/pages/CalloutPage'
import ClassificationsPage from '@/pages/admin/ClassificationsPage'
import ShiftTemplatesPage from '@/pages/admin/ShiftTemplatesPage'
import TeamsPage from '@/pages/admin/TeamsPage'
import TeamDetailPage from '@/pages/admin/TeamDetailPage'
import UsersPage from '@/pages/admin/UsersPage'
import OrgSettingsPage from '@/pages/admin/OrgSettingsPage'
import SchedulePeriodsPage from '@/pages/admin/SchedulePeriodsPage'
import SchedulePeriodDetailPage from '@/pages/admin/SchedulePeriodDetailPage'
import AppShell from '@/components/layout/AppShell'

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
                  <ClassificationsPage />
                </RequireRole>
              }
            />
            <Route
              path="shift-templates"
              element={
                <RequireRole roles="admin">
                  <ShiftTemplatesPage />
                </RequireRole>
              }
            />
            <Route
              path="teams"
              element={
                <RequireRole roles={['admin', 'supervisor']}>
                  <TeamsPage />
                </RequireRole>
              }
            />
            <Route
              path="teams/:id"
              element={
                <RequireRole roles={['admin', 'supervisor']}>
                  <TeamDetailPage />
                </RequireRole>
              }
            />
            <Route
              path="users"
              element={
                <RequireRole roles="admin">
                  <UsersPage />
                </RequireRole>
              }
            />
            <Route
              path="schedule-periods"
              element={
                <RequireRole roles="admin">
                  <SchedulePeriodsPage />
                </RequireRole>
              }
            />
            <Route
              path="schedule-periods/:id"
              element={
                <RequireRole roles="admin">
                  <SchedulePeriodDetailPage />
                </RequireRole>
              }
            />
            <Route
              path="settings"
              element={
                <RequireRole roles="admin">
                  <OrgSettingsPage />
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
