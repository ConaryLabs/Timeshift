import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuthStore, type Role } from '@/store/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface RequireRoleProps {
  roles: Role | Role[]
  children: React.ReactNode
}

export default function RequireRole({ roles, children }: RequireRoleProps) {
  const user = useAuthStore((s) => s.user)
  const allowed = Array.isArray(roles) ? roles : [roles]

  if (!user || !allowed.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to view this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/schedule">Back to Schedule</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
