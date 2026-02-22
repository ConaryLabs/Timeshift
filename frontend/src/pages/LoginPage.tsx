import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import type { UserProfile } from '@/store/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.post<{ token: string; user: UserProfile }>(
        '/api/auth/login',
        { email, password },
      )
      setAuth(res.data.user)
      navigate('/schedule')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div
        className="hidden md:flex md:w-[400px] lg:w-[460px] flex-col relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, oklch(0.27 0.08 252) 0%, oklch(0.185 0.04 255) 65%)',
        }}
      >
        <div className="flex flex-col items-start justify-center flex-1 px-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="font-brand text-3xl text-white">Timeshift</span>
          </div>

          <h2 className="text-2xl font-semibold text-white leading-snug mb-3">
            Shift scheduling for<br />911 dispatch centers
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'oklch(0.72 0.015 255)' }}>
            Manage schedules, leave requests, and callouts — all in one place.
          </p>

          {/* Decorative grid */}
          <div className="mt-16 flex flex-col gap-2 opacity-[0.12]">
            {[7, 5, 6, 4].map((count, row) => (
              <div key={row} className="flex gap-2">
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="h-1.5 w-8 rounded-full bg-white" />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 text-xs" style={{ color: 'oklch(0.50 0.015 255)' }}>
          Valleycom · Kent, WA
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-6">
        {/* Mobile-only logo */}
        <div className="md:hidden flex items-center gap-2.5 mb-10">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-brand text-2xl text-foreground">Timeshift</span>
        </div>

        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Enter your credentials to access your schedule
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2.5">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@organization.org"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
