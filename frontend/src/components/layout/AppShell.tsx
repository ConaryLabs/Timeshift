import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
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
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import { useUIStore } from '@/store/ui'
import { usePermissions } from '@/hooks/usePermissions'
import { useMe, useOrganization, useScheduleGrid, useNavBadges } from '@/hooks/queries'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  badgeKey?: 'pending_leave' | 'pending_trades' | 'open_callouts'
}

function useNavItems(): { main: NavItem[]; admin: NavItem[] } {
  const { isManager, isAdmin } = usePermissions()

  const main: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: '/my-schedule', label: 'My Schedule', icon: <CalendarCheck className="h-4 w-4" /> },
    { to: '/schedule', label: 'Schedule', icon: <Calendar className="h-4 w-4" /> },
    { to: '/leave', label: 'Leave', icon: <ClipboardList className="h-4 w-4" />, badgeKey: 'pending_leave' },
    { to: '/trades', label: 'Trades', icon: <ArrowLeftRight className="h-4 w-4" />, badgeKey: 'pending_trades' },
    { to: '/leave/sellback', label: 'Sellback', icon: <Banknote className="h-4 w-4" /> },
    { to: '/leave/donations', label: 'Donations', icon: <HeartHandshake className="h-4 w-4" /> },
    { to: '/available-ot', label: 'Available OT', icon: <Timer className="h-4 w-4" /> },
    { to: '/volunteered-ot', label: 'My Volunteered OT', icon: <Hand className="h-4 w-4" /> },
  ]

  if (isManager) {
    main.push({ to: '/callout', label: 'Callout', icon: <Phone className="h-4 w-4" />, badgeKey: 'open_callouts' })
  }

  main.push({ to: '/profile', label: 'Profile', icon: <UserCircle className="h-4 w-4" /> })

  const admin: NavItem[] = []
  if (isManager) {
    admin.push(
      { to: '/admin/dashboard', label: 'Ops Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    )
  }

  if (isAdmin) {
    admin.push(
      { to: '/admin/classifications', label: 'Classifications', icon: <Shield className="h-4 w-4" /> },
      { to: '/admin/shift-templates', label: 'Shift Templates', icon: <Clock className="h-4 w-4" /> },
      { to: '/admin/coverage', label: 'Coverage', icon: <Target className="h-4 w-4" /> },
      { to: '/admin/teams', label: 'Teams', icon: <Layers className="h-4 w-4" /> },
      { to: '/admin/users', label: 'Users', icon: <Users className="h-4 w-4" /> },
      { to: '/admin/ot-queue', label: 'OT Queue', icon: <ListOrdered className="h-4 w-4" /> },
      { to: '/admin/leave-balances', label: 'Leave Balances', icon: <Wallet className="h-4 w-4" /> },
      { to: '/admin/schedule-periods', label: 'Bid Periods', icon: <CalendarDays className="h-4 w-4" /> },
      { to: '/admin/vacation-bids', label: 'Vacation Bids', icon: <TreePalm className="h-4 w-4" /> },
      { to: '/admin/holidays', label: 'Holidays', icon: <PartyPopper className="h-4 w-4" /> },
      { to: '/admin/reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
      { to: '/admin/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
    )
  } else if (isManager) {
    admin.push(
      { to: '/admin/teams', label: 'Teams', icon: <Layers className="h-4 w-4" /> },
      { to: '/admin/reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
    )
  }

  return { main, admin }
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
          "flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors relative",
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

function SidebarNav({ main, admin, collapsed, onLinkClick, badges }: {
  main: NavItem[]
  admin: NavItem[]
  collapsed: boolean
  onLinkClick?: () => void
  badges?: Record<string, number>
}) {
  return (
    <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
      {main.map((item) => (
        <SidebarLink
          key={item.to}
          item={item}
          collapsed={collapsed}
          onClick={onLinkClick}
          badgeCount={item.badgeKey && badges ? badges[item.badgeKey] : undefined}
        />
      ))}

      {admin.length > 0 && (
        <>
          <div className="my-2.5 mx-1 h-px bg-sidebar-border" />
          {!collapsed && (
            <p className="px-3 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest mb-1">
              Admin
            </p>
          )}
          {admin.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} onClick={onLinkClick} />
          ))}
        </>
      )}
    </nav>
  )
}

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3 h-14 border-b border-sidebar-border",
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
  const { main, admin } = useNavItems()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [coverageOpen, setCoverageOpen] = useState(false)
  const { isManager } = usePermissions()

  useMe()
  const { data: org } = useOrganization()
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: todayCoverage } = useScheduleGrid(today, today)
  const { data: navBadges } = useNavBadges()

  const badges = useMemo(() => {
    if (!navBadges) return undefined
    return {
      pending_leave: navBadges.pending_leave,
      pending_trades: navBadges.pending_trades,
      open_callouts: navBadges.open_callouts,
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

  // L7: Keyboard shortcut Cmd+B / Ctrl+B to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
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
        className={cn(
          "hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <SidebarLogo collapsed={collapsed} />

        <SidebarNav main={main} admin={admin} collapsed={collapsed} badges={badges} />

        {/* Footer: collapse toggle */}
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] text-sidebar-foreground hover:bg-white/[0.06] hover:text-white transition-colors",
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
          <SidebarNav main={main} admin={admin} collapsed={false} onLinkClick={() => setMobileOpen(false)} badges={badges} />
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
            {isManager && understaffedShifts.length > 0 && (
              <Popover open={coverageOpen} onOpenChange={setCoverageOpen}>
                <PopoverTrigger asChild>
                  <button className="relative p-1.5 rounded-md hover:bg-accent transition-colors" aria-label="Coverage alerts">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                      {understaffedShifts.length}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72">
                  <p className="text-sm font-medium mb-2">Understaffed Shifts Today</p>
                  <div className="space-y-1.5">
                    {understaffedShifts.map((s) => (
                      <div key={s.shift_template_id} className="flex items-center justify-between text-sm">
                        <span>{s.shift_name}</span>
                        <span className="text-destructive font-medium tabular-nums">{s.coverage_actual}/{s.coverage_required}</span>
                      </div>
                    ))}
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
    </div>
  )
}
