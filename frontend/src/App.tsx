import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import RequireRole from '@/components/RequireRole'
import ErrorBoundary from '@/components/ErrorBoundary'
import { LoadingState } from '@/components/ui/loading-state'
import AppShell from '@/components/layout/AppShell'

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SchedulePage = lazy(() => import('@/pages/SchedulePage'))
const LeavePage = lazy(() => import('@/pages/LeavePage'))
const CalloutPage = lazy(() => import('@/pages/CalloutPage'))
const TradesPage = lazy(() => import('@/pages/TradesPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const DayViewPage = lazy(() => import('@/pages/DayViewPage'))
const VacationBidPage = lazy(() => import('@/pages/VacationBidPage'))
const BidPage = lazy(() => import('@/pages/BidPage'))
const MyDashboardPage = lazy(() => import('@/pages/MyDashboardPage'))
const MySchedulePage = lazy(() => import('@/pages/MySchedulePage'))
const MyProfilePage = lazy(() => import('@/pages/MyProfilePage'))
const LeaveSellbackPage = lazy(() => import('@/pages/LeaveSellbackPage'))
const SickDonationPage = lazy(() => import('@/pages/SickDonationPage'))
const ClassificationsPage = lazy(() => import('@/pages/admin/ClassificationsPage'))
const ShiftTemplatesPage = lazy(() => import('@/pages/admin/ShiftTemplatesPage'))
const TeamsPage = lazy(() => import('@/pages/admin/TeamsPage'))
const TeamDetailPage = lazy(() => import('@/pages/admin/TeamDetailPage'))
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'))
const OrgSettingsPage = lazy(() => import('@/pages/admin/OrgSettingsPage'))
const OTQueuePage = lazy(() => import('@/pages/admin/OTQueuePage'))
const LeaveBalancesPage = lazy(() => import('@/pages/admin/LeaveBalancesPage'))
const SchedulePeriodsPage = lazy(() => import('@/pages/admin/SchedulePeriodsPage'))
const SchedulePeriodDetailPage = lazy(() => import('@/pages/admin/SchedulePeriodDetailPage'))
const VacationBidAdminPage = lazy(() => import('@/pages/admin/VacationBidAdminPage'))
const HolidayCalendarPage = lazy(() => import('@/pages/admin/HolidayCalendarPage'))
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage'))
const CoverageRequirementsPage = lazy(() => import('@/pages/admin/CoverageRequirementsPage'))
const AvailableOTPage = lazy(() => import('@/pages/AvailableOTPage'))
const VolunteeredOTPage = lazy(() => import('@/pages/VolunteeredOTPage'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function PageSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<PageSuspense><LoginPage /></PageSuspense>} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          {/* Core pages */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<PageSuspense><MyDashboardPage /></PageSuspense>} />
          <Route path="my-schedule" element={<PageSuspense><MySchedulePage /></PageSuspense>} />
          <Route path="profile" element={<PageSuspense><MyProfilePage /></PageSuspense>} />
          <Route path="schedule" element={<PageSuspense><SchedulePage /></PageSuspense>} />
          <Route path="schedule/day/:date" element={<PageSuspense><DayViewPage /></PageSuspense>} />
          <Route path="leave" element={<PageSuspense><LeavePage /></PageSuspense>} />
          <Route path="leave/sellback" element={<PageSuspense><LeaveSellbackPage /></PageSuspense>} />
          <Route path="leave/donations" element={<PageSuspense><SickDonationPage /></PageSuspense>} />
          <Route path="trades" element={<PageSuspense><TradesPage /></PageSuspense>} />
          <Route path="available-ot" element={<PageSuspense><AvailableOTPage /></PageSuspense>} />
          <Route path="volunteered-ot" element={<PageSuspense><VolunteeredOTPage /></PageSuspense>} />
          <Route
            path="callout"
            element={
              <RequireRole roles={['admin', 'supervisor']}>
                <PageSuspense><CalloutPage /></PageSuspense>
              </RequireRole>
            }
          />
          <Route path="vacation-bid/:windowId" element={<PageSuspense><VacationBidPage /></PageSuspense>} />
          <Route path="bid/:windowId" element={<PageSuspense><BidPage /></PageSuspense>} />

          {/* Admin routes */}
          <Route path="admin">
            <Route
              path="classifications"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><ClassificationsPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="shift-templates"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><ShiftTemplatesPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="coverage"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><CoverageRequirementsPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="teams"
              element={
                <RequireRole roles={['admin', 'supervisor']}>
                  <PageSuspense><TeamsPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="teams/:id"
              element={
                <RequireRole roles={['admin', 'supervisor']}>
                  <PageSuspense><TeamDetailPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="users"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><UsersPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="ot-queue"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><OTQueuePage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="leave-balances"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><LeaveBalancesPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="schedule-periods"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><SchedulePeriodsPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="schedule-periods/:id"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><SchedulePeriodDetailPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="vacation-bids"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><VacationBidAdminPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="holidays"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><HolidayCalendarPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="dashboard"
              element={
                <RequireRole roles={['admin', 'supervisor']}>
                  <PageSuspense><DashboardPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="reports"
              element={
                <RequireRole roles={['admin', 'supervisor']}>
                  <PageSuspense><ReportsPage /></PageSuspense>
                </RequireRole>
              }
            />
            <Route
              path="settings"
              element={
                <RequireRole roles="admin">
                  <PageSuspense><OrgSettingsPage /></PageSuspense>
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
