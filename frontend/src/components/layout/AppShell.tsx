import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/store/auth'
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
    { to: '/schedule', label: 'Schedule', icon: <Calendar className="h-4 w-4" /> },
    { to: '/leave', label: 'Leave', icon: <ClipboardList className="h-4 w-4" /> },
  ]

  if (isManager) {
    main.push({ to: '/callout', label: 'Callout', icon: <Phone className="h-4 w-4" /> })
  }

  const admin: NavItem[] = []
  if (isAdmin) {
    admin.push(
      { to: '/admin/classifications', label: 'Classifications', icon: <Shield className="h-4 w-4" /> },
      { to: '/admin/shift-templates', label: 'Shift Templates', icon: <Clock className="h-4 w-4" /> },
      { to: '/admin/teams', label: 'Teams', icon: <Layers className="h-4 w-4" /> },
      { to: '/admin/users', label: 'Users', icon: <Users className="h-4 w-4" /> },
      { to: '/admin/schedule-periods', label: 'Bid Periods', icon: <CalendarDays className="h-4 w-4" /> },
      { to: '/admin/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
    )
  } else if (isManager) {
    admin.push(
      { to: '/admin/teams', label: 'Teams', icon: <Layers className="h-4 w-4" /> },
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
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
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
    <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
      {main.map((item) => (
        <SidebarLink key={item.to} item={item} collapsed={collapsed} onClick={onLinkClick} />
      ))}

      {admin.length > 0 && (
        <>
          <Separator className="my-3" />
          {!collapsed && (
            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
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
    logout()
    navigate('/login')
  }

  const collapsed = !sidebarOpen

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar (lg and above) */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r bg-card transition-all duration-200",
          collapsed ? "w-14" : "w-56",
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-2 px-3 h-14 border-b", collapsed && "justify-center")}>
          <Building2 className="h-5 w-5 text-primary shrink-0" />
          {!collapsed && <span className="font-bold text-lg tracking-tight">Timeshift</span>}
        </div>

        {/* Nav */}
        <SidebarNav main={main} admin={admin} collapsed={collapsed} />

        {/* Footer */}
        <div className="border-t p-2 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn("w-full", collapsed ? "justify-center px-2" : "justify-start")}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar sheet (below lg) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b px-3 h-14 flex-row items-center gap-2">
            <Building2 className="h-5 w-5 text-primary shrink-0" />
            <SheetTitle className="font-bold text-lg tracking-tight">Timeshift</SheetTitle>
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

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.first_name} {user?.last_name}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Log out
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
