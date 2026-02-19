import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import type { UserProfile } from '../store/auth'

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
      setAuth(res.data.token, res.data.user)
      navigate('/schedule')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
      <form
        onSubmit={handleSubmit}
        style={{ background: '#fff', padding: '2rem', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: 340 }}
      >
        <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', color: '#1e3a5f' }}>Timeshift</h1>
        {error && (
          <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>
        )}
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4, border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4, border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '0.625rem', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
