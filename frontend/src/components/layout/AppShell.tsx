import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import { useUIStore } from '@/store/ui'
import { usePermissions } from '@/hooks/usePermissions'
import { useMe } from '@/hooks/queries'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

function useNavItems(): { main: NavItem[]; admin: NavItem[] } {
  const { isManager, isAdmin } = usePermissions()

  const main: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: '/my-schedule', label: 'My Schedule', icon: <CalendarCheck className="h-4 w-4" /> },
    { to: '/schedule', label: 'Schedule', icon: <Calendar className="h-4 w-4" /> },
    { to: '/leave', label: 'Leave', icon: <ClipboardList className="h-4 w-4" /> },
    { to: '/trades', label: 'Trades', icon: <ArrowLeftRight className="h-4 w-4" /> },
  ]

  if (isManager) {
    main.push({ to: '/callout', label: 'Callout', icon: <Phone className="h-4 w-4" /> })
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

function SidebarLink({ item, collapsed, onClick }: { item: NavItem; collapsed: boolean; onClick?: () => void }) {
  const link = (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-primary/20 text-white"
            : "text-sidebar-foreground hover:bg-white/[0.06] hover:text-white",
          collapsed && "justify-center px-2",
        )
      }
    >
      {item.icon}
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}

function SidebarNav({ main, admin, collapsed, onLinkClick }: {
  main: NavItem[]
  admin: NavItem[]
  collapsed: boolean
  onLinkClick?: () => void
}) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
      {main.map((item) => (
        <SidebarLink key={item.to} item={item} collapsed={collapsed} onClick={onLinkClick} />
      ))}

      {admin.length > 0 && (
        <>
          <div className="my-3 h-px bg-sidebar-border" />
          {!collapsed && (
            <p className="px-3 text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest mb-1">
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
    <div className={cn("flex items-center gap-2.5 px-3 h-14 border-b border-sidebar-border", collapsed && "justify-center")}>
      <div className="h-7 w-7 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
        <Building2 className="h-4 w-4 text-white" />
      </div>
      {!collapsed && (
        <span className="font-brand text-xl text-white tracking-tight">Timeshift</span>
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

  useMe()

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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar (lg and above) */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <SidebarLogo collapsed={collapsed} />

        <SidebarNav main={main} admin={admin} collapsed={collapsed} />

        {/* Footer: collapse toggle */}
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={toggleSidebar}
            className={cn(
              "w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-white/[0.06] hover:text-white transition-colors",
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
            <div className="h-7 w-7 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <SheetTitle className="font-brand text-xl text-white tracking-tight">Timeshift</SheetTitle>
          </SheetHeader>
          <SidebarNav main={main} admin={admin} collapsed={false} onLinkClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 h-14 border-b px-4 bg-card">
          {/* Mobile hamburger (below lg) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>

          {/* Spacer for desktop where hamburger is hidden */}
          <div className="hidden lg:block" />

          <div className="flex items-center gap-2">
            {initials && (
              <div className="hidden sm:flex h-7 w-7 rounded-full bg-primary/10 text-primary items-center justify-center text-xs font-semibold shrink-0">
                {initials}
              </div>
            )}
            <span className="hidden sm:block text-sm font-medium text-foreground">
              {user?.first_name} {user?.last_name}
            </span>
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

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
