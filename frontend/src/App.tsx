import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import RequireRole from '@/components/RequireRole'
import ErrorBoundary from '@/components/ErrorBoundary'
import LoginPage from '@/pages/LoginPage'
import SchedulePage from '@/pages/SchedulePage'
import LeavePage from '@/pages/LeavePage'
import CalloutPage from '@/pages/CalloutPage'
import TradesPage from '@/pages/TradesPage'
import ClassificationsPage from '@/pages/admin/ClassificationsPage'
import ShiftTemplatesPage from '@/pages/admin/ShiftTemplatesPage'
import TeamsPage from '@/pages/admin/TeamsPage'
import TeamDetailPage from '@/pages/admin/TeamDetailPage'
import UsersPage from '@/pages/admin/UsersPage'
import OrgSettingsPage from '@/pages/admin/OrgSettingsPage'
import OTQueuePage from '@/pages/admin/OTQueuePage'
import LeaveBalancesPage from '@/pages/admin/LeaveBalancesPage'
import SchedulePeriodsPage from '@/pages/admin/SchedulePeriodsPage'
import SchedulePeriodDetailPage from '@/pages/admin/SchedulePeriodDetailPage'
import VacationBidAdminPage from '@/pages/admin/VacationBidAdminPage'
import HolidayCalendarPage from '@/pages/admin/HolidayCalendarPage'
import ReportsPage from '@/pages/admin/ReportsPage'
import DayViewPage from '@/pages/DayViewPage'
import CoverageRequirementsPage from '@/pages/admin/CoverageRequirementsPage'
import VacationBidPage from '@/pages/VacationBidPage'
import BidPage from '@/pages/BidPage'
import MyDashboardPage from '@/pages/MyDashboardPage'
import MySchedulePage from '@/pages/MySchedulePage'
import MyProfilePage from '@/pages/MyProfilePage'
import AppShell from '@/components/layout/AppShell'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  return user ? <>{children}</> : <Navigate to="/login" replace />
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
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<MyDashboardPage />} />
          <Route path="my-schedule" element={<MySchedulePage />} />
          <Route path="profile" element={<MyProfilePage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="schedule/day/:date" element={<DayViewPage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="trades" element={<TradesPage />} />
          <Route
            path="callout"
            element={
              <RequireRole roles={['admin', 'supervisor']}>
                <CalloutPage />
              </RequireRole>
            }
          />
          <Route path="vacation-bid/:windowId" element={<VacationBidPage />} />
          <Route path="bid/:windowId" element={<BidPage />} />

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
              path="coverage"
              element={
                <RequireRole roles="admin">
                  <CoverageRequirementsPage />
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
              path="ot-queue"
              element={
                <RequireRole roles="admin">
                  <OTQueuePage />
                </RequireRole>
              }
            />
            <Route
              path="leave-balances"
              element={
                <RequireRole roles="admin">
                  <LeaveBalancesPage />
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
              path="vacation-bids"
              element={
                <RequireRole roles="admin">
                  <VacationBidAdminPage />
                </RequireRole>
              }
            />
            <Route
              path="holidays"
              element={
                <RequireRole roles="admin">
                  <HolidayCalendarPage />
                </RequireRole>
              }
            />
            <Route
              path="reports"
              element={
                <RequireRole roles={['admin', 'supervisor']}>
                  <ReportsPage />
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
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
