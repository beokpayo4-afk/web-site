import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import { type AdminArea, canAccess } from '@/lib/adminAccess'

function GuardMessage({ children }: { children: string }) {
  return <p className="bg-paper p-8 text-ink-soft">{children}</p>
}

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <GuardMessage>Loading account…</GuardMessage>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequireStaff() {
  const { isStaff, isLoading, isAuthenticated } = useAuth()
  const location = useLocation()
  if (isLoading) return <GuardMessage>Loading operations…</GuardMessage>
  if (!isAuthenticated) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (!isStaff) return <Navigate to="/" replace />
  return <Outlet />
}

export function RequireAdminArea({ area }: { area: AdminArea }) {
  const { profile, isLoading, isStaff } = useAuth()
  if (isLoading) return <GuardMessage>Loading operations…</GuardMessage>
  if (!isStaff || !canAccess(profile?.role, area)) return <Navigate to="/admin" replace />
  return <Outlet />
}

export function GuestOnly() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <p className="p-8">Loading account…</p>
  if (isAuthenticated) return <Navigate to="/" replace />
  return <Outlet />
}
