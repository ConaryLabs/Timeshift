import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Bell,
  Calendar,
  CalendarDays,
  ClipboardList,
  Phone,
  Users,
  Building2,
  Layers,
  Clock,
  Shield,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Settings,
  Menu,
  Wallet,
  ListOrdered,
  TreePalm,
  CalendarCheck,
  UserCircle,
  LayoutDashboard,
  BarChart3,
  PartyPopper,
  Target,
  AlertTriangle,
  Banknote,
  HeartHandshake,
  Timer,
  Hand,
  ClipboardCheck,
  BadgeCheck,
  RotateCw,
  ChevronDown,
  Megaphone,
  ListChecks,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { lazy, Suspense } from 'react'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import { broadcastLogout } from '@/api/client'
import { useUIStore } from '@/store/ui'
import { usePermissions } from '@/hooks/usePermissions'
import { useMe, useOrganization, useScheduleGrid, useNavBadges, useUnreadCount, useCoverageGaps, useCoverageGapBlocks } from '@/hooks/queries'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const SmsAlertDialog = lazy(() => import('@/components/coverage/SmsAlertDialog'))

/** Format "08:00" → "08", "08:30" → "0830" for compact display */
function fmtBlockTime(t: string): string {
  if (t.endsWith(':00')) return t.slice(0, 2)
  return t.replace(':', '')
}

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  badgeKey?: 'pending_leave' | 'pending_trades' | 'open_callouts' | 'pending_approvals'
}

interface NavGroup {
  label: string
  items: NavItem[]
}

function useNavItems(): { groups: NavGroup[]; profile: NavItem } {
  const { isManager, isAdmin } = usePermissions()

  const groups: NavGroup[] = []

  // 1. Operations (managers only) — at the TOP
  if (isManager) {
    groups.push({
      label: 'Operations',
      items: [
        { to: '/admin/dashboard', label: 'Ops Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
        { to: '/staffing/resolve', label: 'Daily Staffing', icon: <ShieldAlert className="h-4 w-4" /> },
        { to: '/approvals', label: 'Approvals', icon: <ListChecks className="h-4 w-4" />, badgeKey: 'pending_approvals' },
        { to: '/callout', label: 'Callout', icon: <Phone className="h-4 w-4" />, badgeKey: 'open_callouts' },
        { to: '/admin/reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
      ],
    })
  }

  // 2. Personal items (everyone)
  groups.push(
    {
      label: '',
      items: [
        { to: '/dashboard', label: isManager ? 'My Dashboard' : 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
        { to: '/my-schedule', label: 'My Schedule', icon: <CalendarCheck className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Schedule',
      items: [
        { to: '/schedule', label: 'Schedule', icon: <Calendar className="h-4 w-4" /> },
        { to: '/duty-board', label: 'Duty Board', icon: <ClipboardCheck className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Requests',
      items: [
        { to: '/leave', label: 'Leave', icon: <ClipboardList className="h-4 w-4" />, badgeKey: 'pending_leave' },
        { to: '/trades', label: 'Trades', icon: <ArrowLeftRight className="h-4 w-4" />, badgeKey: 'pending_trades' },
        { to: '/leave/sellback', label: 'Sellback', icon: <Banknote className="h-4 w-4" /> },
        { to: '/leave/donations', label: 'Donations', icon: <HeartHandshake className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Overtime',
      items: [
        { to: '/available-ot', label: 'Available OT', icon: <Timer className="h-4 w-4" /> },
        { to: '/volunteered-ot', label: 'Volunteered OT', icon: <Hand className="h-4 w-4" /> },
      ],
    },
  )

  // 3. Team (supervisor + admin)
  if (isManager) {
    groups.push({
      label: 'Team',
      items: [
        { to: '/admin/teams', label: 'Teams', icon: <Layers className="h-4 w-4" /> },
        { to: '/admin/special-assignments', label: 'Assignments', icon: <BadgeCheck className="h-4 w-4" /> },
        { to: '/admin/duty-positions', label: 'Duty Positions', icon: <ClipboardCheck className="h-4 w-4" /> },
        { to: '/admin/shift-patterns', label: 'Shift Patterns', icon: <RotateCw className="h-4 w-4" /> },
      ],
    })
  }

  // 4. Config (admin only)
  if (isAdmin) {
    groups.push(
      {
        label: 'Configuration',
        items: [
          { to: '/admin/shift-templates', label: 'Shift Templates', icon: <Clock className="h-4 w-4" /> },
          { to: '/admin/classifications', label: 'Classifications', icon: <Shield className="h-4 w-4" /> },
          { to: '/admin/coverage-plans', label: 'Coverage Plans', icon: <Target className="h-4 w-4" /> },
        ],
      },
      {
        label: 'People',
        items: [
          { to: '/admin/users', label: 'Users', icon: <Users className="h-4 w-4" /> },
          { to: '/admin/ot-queue', label: 'OT Queue', icon: <ListOrdered className="h-4 w-4" /> },
          { to: '/admin/leave-balances', label: 'Leave Balances', icon: <Wallet className="h-4 w-4" /> },
        ],
      },
      {
        label: 'Scheduling',
        items: [
          { to: '/admin/schedule-periods', label: 'Bid Periods', icon: <CalendarDays className="h-4 w-4" /> },
          { to: '/admin/vacation-bids', label: 'Vacation Bids', icon: <TreePalm className="h-4 w-4" /> },
          { to: '/admin/holidays', label: 'Holidays', icon: <PartyPopper className="h-4 w-4" /> },
        ],
      },
      {
        label: '',
        items: [
          { to: '/admin/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
        ],
      },
    )
  }

  const profile: NavItem = { to: '/profile', label: 'Profile', icon: <UserCircle className="h-4 w-4" /> }

  return { groups, profile }
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="nav-badge flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function SidebarLink({
  item,
  collapsed,
  onClick,
  badgeCount,
}: {
  item: NavItem
  collapsed: boolean
  onClick?: () => void
  badgeCount?: number
}) {
  const link = (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-[5px] text-[13px] font-medium transition-colors relative",
          isActive
            ? "nav-link-active bg-sidebar-accent text-white"
            : "text-sidebar-foreground hover:bg-white/[0.06] hover:text-white",
          collapsed && "justify-center px-2",
        )
      }
    >
      <span className="relative shrink-0">
        {item.icon}
        {collapsed && badgeCount && badgeCount > 0 ? (
          <span className="nav-badge absolute -top-1.5 -right-2 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-white leading-none">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {badgeCount && badgeCount > 0 ? <NavBadge count={badgeCount} /> : null}
        </>
      )}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.label}
          {badgeCount && badgeCount > 0 ? (
            <span className="flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white leading-none">
              {badgeCount}
            </span>
          ) : null}
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}

function NavGroupSection({
  group,
  collapsed,
  onLinkClick,
  badges,
  sectionKey,
  collapsible = false,
}: {
  group: NavGroup
  collapsed: boolean
  onLinkClick?: () => void
  badges?: Record<string, number>
  sectionKey?: string
  collapsible?: boolean
}) {
  const toggleSection = useUIStore((s) => s.toggleSection)
  const isSectionCollapsed = useUIStore((s) => s.collapsedSections[sectionKey ?? ''] ?? false)

  const canCollapse = collapsible && sectionKey && group.label && !collapsed

  return (
    <div>
      {group.label && !collapsed && (
        canCollapse ? (
          <button
            onClick={() => toggleSection(sectionKey!)}
            className="w-full flex items-center justify-between px-3 pt-2.5 pb-0.5 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest hover:text-sidebar-foreground/60 transition-colors group/section"
          >
            <span>{group.label}</span>
            <ChevronDown className={cn(
              "h-2.5 w-2.5 opacity-0 group-hover/section:opacity-100 transition-all duration-200",
              isSectionCollapsed && "-rotate-90",
            )} />
          </button>
        ) : (
          <p className="px-3 pt-2.5 pb-0.5 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
            {group.label}
          </p>
        )
      )}
      {collapsed && group.label && (
        <div className="my-1 mx-2 h-px bg-sidebar-border/50" />
      )}
      <div className={cn(
        "space-y-px transition-all duration-200 overflow-hidden",
        canCollapse && isSectionCollapsed && "max-h-0",
        (!canCollapse || !isSectionCollapsed) && "max-h-[500px]",
      )}>
        {group.items.map((item) => (
          <SidebarLink
            key={item.to}
            item={item}
            collapsed={collapsed}
            onClick={onLinkClick}
            badgeCount={item.badgeKey && badges ? badges[item.badgeKey] : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function SidebarNav({ groups, collapsed, onLinkClick, badges }: {
  groups: NavGroup[]
  collapsed: boolean
  onLinkClick?: () => void
  badges?: Record<string, number>
}) {
  return (
    <nav aria-label="Main navigation" className="flex-1 sidebar-scroll overflow-y-auto py-1 px-2">
      {groups.map((group, i) => (
        <NavGroupSection
          key={group.label || `group-${i}`}
          group={group}
          collapsed={collapsed}
          onLinkClick={onLinkClick}
          badges={badges}
          sectionKey={`nav-${group.label || `unlabeled-${i}`}`}
          collapsible
        />
      ))}
    </nav>
  )
}

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3 h-14 border-b border-sidebar-border shrink-0",
      collapsed && "justify-center",
    )}>
      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center shrink-0 shadow-sm shadow-sidebar-primary/25">
        <Building2 className="h-4 w-4 text-white" />
      </div>
      {!collapsed && (
        <span className="font-brand text-[19px] text-white tracking-tight">Timeshift</span>
      )}
    </div>
  )
}

export default function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const navigate = useNavigate()
  const { groups, profile } = useNavItems()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [coverageOpen, setCoverageOpen] = useState(false)
  const [smsDialogOpen, setSmsDialogOpen] = useState(false)
  const { isManager } = usePermissions()

  useMe()
  const { data: org } = useOrganization()
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: todayCoverage } = useScheduleGrid(today, today, undefined, { enabled: isManager })
  const { data: coverageGaps } = useCoverageGaps(today, { enabled: isManager })
  const { data: gapBlocks } = useCoverageGapBlocks(today, { enabled: isManager })
  const { data: navBadges } = useNavBadges()
  const { data: unreadCountData } = useUnreadCount()
  const notificationCount = unreadCountData?.count ?? 0

  const badges = useMemo(() => {
    if (!navBadges) return undefined
    return {
      pending_leave: navBadges.pending_leave,
      pending_trades: navBadges.pending_trades,
      open_callouts: navBadges.open_callouts,
      pending_approvals: navBadges.pending_leave + navBadges.pending_trades,
    }
  }, [navBadges])

  const timezoneAbbr = org?.timezone
    ? new Intl.DateTimeFormat('en-US', { timeZone: org.timezone, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find(p => p.type === 'timeZoneName')?.value ?? org.timezone
    : null

  const understaffedShifts = useMemo(() => {
    if (!isManager || !todayCoverage) return []
    return todayCoverage.filter((c) => c.coverage_required > 0 && c.coverage_actual < c.coverage_required)
  }, [isManager, todayCoverage])

  const hasGaps = (gapBlocks?.length ?? 0) > 0

  // L7: Keyboard shortcut Cmd+B / Ctrl+B to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  function handleLogout() {
    authApi.logout().catch(() => {})
    logout()
    broadcastLogout()
    navigate('/login')
  }

  const collapsed = !sidebarOpen

  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('')

  const totalBadgeCount = navBadges
    ? navBadges.pending_leave + navBadges.pending_trades + navBadges.open_callouts
    : 0

  return (
    <div className="flex h-screen overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:border"
      >
        Skip to content
      </a>
      {/* Desktop sidebar (lg and above) */}
      <aside
        aria-label="Sidebar"
        className={cn(
          "hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <SidebarLogo collapsed={collapsed} />

        <SidebarNav groups={groups} collapsed={collapsed} badges={badges} />

        {/* Footer: profile + collapse toggle */}
        <div className="border-t border-sidebar-border shrink-0 px-2 py-1.5 space-y-0.5">
          <SidebarLink item={profile} collapsed={collapsed} />
          <button
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "w-full flex items-center gap-3 rounded-md px-3 py-[5px] text-[13px] text-sidebar-foreground hover:bg-white/[0.06] hover:text-white transition-colors",
              collapsed ? "justify-center px-2" : "justify-start",
            )}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar sheet (below lg) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border gap-0" showCloseButton={false}>
          <SheetHeader className="border-b border-sidebar-border px-3 h-14 flex-row items-center gap-2.5 p-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center shrink-0 shadow-sm shadow-sidebar-primary/25">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <SheetTitle className="font-brand text-[19px] text-white tracking-tight">Timeshift</SheetTitle>
          </SheetHeader>
          <SidebarNav groups={groups} collapsed={false} onLinkClick={() => setMobileOpen(false)} badges={badges} />
          <div className="border-t border-sidebar-border shrink-0 px-2 py-1.5">
            <SidebarLink item={profile} collapsed={false} onClick={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 h-14 border-b px-4 bg-card shadow-[0_1px_3px_0_oklch(0_0_0/0.04)]">
          {/* Mobile hamburger (below lg) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden relative"
          >
            <Menu className="h-5 w-5" />
            {totalBadgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-white leading-none">
                {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
              </span>
            )}
            <span className="sr-only">Open menu</span>
          </Button>

          {/* Spacer for desktop where hamburger is hidden */}
          <div className="hidden lg:block" />

          <div className="flex items-center gap-2">
            {timezoneAbbr && (
              <span className="hidden sm:block text-xs text-muted-foreground font-medium tabular-nums">
                {timezoneAbbr}
              </span>
            )}
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-1.5 rounded-md hover:bg-accent transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-white leading-none">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
            {isManager && (hasGaps || understaffedShifts.length > 0) && (
              <Popover open={coverageOpen} onOpenChange={setCoverageOpen}>
                <PopoverTrigger asChild>
                  <button className="relative p-1.5 rounded-md hover:bg-accent transition-colors" aria-label="Coverage alerts">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-0.5">
                      {(gapBlocks?.length ?? 0) || understaffedShifts.length}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
                  <div className="mb-3">
                    <p className="text-sm font-semibold">Staffing Gaps Today</p>
                  </div>
                  {hasGaps ? (
                    <div className="space-y-3">
                      {gapBlocks!.map((cls) => (
                        <div key={cls.classification_id}>
                          <button
                            className="text-sm font-semibold mb-1 hover:underline text-left"
                            onClick={() => { setCoverageOpen(false); navigate(`/staffing/resolve?date=${today}&classification=${cls.classification_abbreviation}`) }}
                          >
                            {cls.classification_abbreviation} OT
                          </button>
                          <div className="flex flex-wrap gap-1.5">
                            {cls.blocks.map((block, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                              >
                                {block.start_time === block.end_time
                                  ? 'All day'
                                  : `${fmtBlockTime(block.start_time)}-${fmtBlockTime(block.end_time)}`}
                                {block.shortage > 1 && (
                                  <span className="text-red-500 dark:text-red-300 font-bold">x{block.shortage}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : understaffedShifts.length > 0 ? (
                    <div className="space-y-1">
                      {understaffedShifts.map((s) => (
                        <button
                          key={s.shift_template_id}
                          className="flex items-center justify-between text-sm w-full rounded-md px-2 py-1.5 hover:bg-accent transition-colors text-left"
                          onClick={() => { setCoverageOpen(false); navigate(`/schedule/day/${today}`) }}
                        >
                          <span>{s.shift_name}</span>
                          <span className="text-destructive font-medium tabular-nums">{s.coverage_actual}/{s.coverage_required}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => { setCoverageOpen(false); navigate(`/schedule/day/${today}`) }}
                      >
                        Day View
                      </button>
                      <span className="text-xs text-muted-foreground">|</span>
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setCoverageOpen(false)
                          const classParam = gapBlocks?.length === 1 ? `&classification=${gapBlocks[0].classification_abbreviation}` : ''
                          navigate(`/staffing/resolve?date=${today}${classParam}`)
                        }}
                      >
                        Resolve Staffing
                      </button>
                    </div>
                    <button
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      onClick={() => { setSmsDialogOpen(true); setCoverageOpen(false) }}
                    >
                      <Megaphone className="h-3 w-3" />
                      Send OT Alert
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <div className="hidden sm:flex items-center gap-2 ml-1">
              {initials && (
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {initials}
                </div>
              )}
              <span className="text-sm font-medium text-foreground">
                {user?.first_name} {user?.last_name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* SMS Alert Dialog */}
      {smsDialogOpen && (
        <Suspense fallback={null}>
          <SmsAlertDialog
            date={today}
            gaps={coverageGaps ?? []}
            open={smsDialogOpen}
            onOpenChange={setSmsDialogOpen}
          />
        </Suspense>
      )}
    </div>
  )
}
