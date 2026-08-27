import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Alert, Card, PageHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/api'

export function AdminLoginPage() {
  const { isAuthenticated, isStaff, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('admin@nexora.local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (isLoading) return <p className="p-8 text-ink-soft">Loading…</p>
  if (isAuthenticated && isStaff) return <Navigate to={(location.state as { from?: string } | null)?.from || '/'} replace />

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <PageHeader kicker="Admin" title="Sign in to Nexora Admin" />
      <Card className="mt-4 space-y-4">
        {isAuthenticated && !isStaff ? (
          <Alert>This account is a customer account. Use a staff login for admin.</Alert>
        ) : null}
        {error ? <Alert>{error}</Alert> : null}
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            setPending(true)
            setError('')
            void login(email, password)
              .then(() => navigate((location.state as { from?: string } | null)?.from || '/', { replace: true }))
              .catch((err) => setError(getErrorMessage(err, 'Could not sign in.')))
              .finally(() => setPending(false))
          }}
        >
          <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <Link to="/" className="block text-sm font-semibold text-pine">
          Back to storefront
        </Link>
      </Card>
    </div>
  )
}
