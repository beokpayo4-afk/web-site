import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'

import { AdminToastProvider } from '@/components/admin/AdminToast'
import { useAuth } from '@/hooks/useAuth'
import { ADMIN_NAV, canAccess, type AdminNavItem } from '@/lib/adminAccess'

function NavIcon({ name }: { name: AdminNavItem['icon'] }) {
  const common = 'size-5 shrink-0'
  if (name === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4h7v7H4V4Zm9 0h7v5h-7V4ZM4 13h7v7H4v-7Zm9 3h7v4h-7v-4Z" />
      </svg>
    )
  }
  if (name === 'products') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 8 12 4l8 4v8l-8 4-8-4V8Z" />
        <path d="M12 12v8M4 8l8 4 8-4" />
      </svg>
    )
  }
  if (name === 'add') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'orders') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 4h10l1 4H6l1-4Z" strokeLinejoin="round" />
        <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
        <path d="M9 12h6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'settings') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10h18M5 10V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2M6 10v8h12v-8" />
    </svg>
  )
}

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
  }`
}

function childNavClass(active: boolean) {
  return `block rounded-lg px-3 py-1.5 text-sm transition ${
    active ? 'bg-white/15 font-semibold text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
  }`
}

function OrdersNavGroup({ item, onNavigate }: { item: AdminNavItem; onNavigate?: () => void }) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const onOrders = location.pathname.startsWith('/admin/orders')
  const [open, setOpen] = useState(onOrders)
  const currentStatus = searchParams.get('status') || ''

  useEffect(() => {
    if (onOrders) setOpen(true)
  }, [onOrders])

  return (
    <div>
      <button
        type="button"
        className={`${navClass({ isActive: onOrders })} w-full`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <NavIcon name="orders" />
        <span className="flex-1 text-left">{item.label}</span>
        <svg
          viewBox="0 0 24 24"
          className={`size-4 shrink-0 transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && item.children ? (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-white/15 pl-3">
          {item.children.map((child) => {
            const active = onOrders && (child.status ? currentStatus === child.status : !currentStatus)
            return (
              <Link key={child.id} to={child.to} className={childNavClass(active)} onClick={onNavigate}>
                {child.label}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, logout } = useAuth()
  const now = new Date()

  return (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-3 px-1" onClick={onNavigate}>
        <span className="flex size-10 items-center justify-center rounded-xl bg-clay text-sm font-bold text-white">N</span>
        <span>
          <span className="block font-display text-xl leading-none text-white">Nexora</span>
          <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-white/55">Admin Panel</span>
        </span>
      </Link>

      <nav className="mt-8 space-y-1" aria-label="Admin">
        {ADMIN_NAV.filter((item) => canAccess(profile?.role, item.area)).map((item) => {
          if (item.children?.length) {
            return <OrdersNavGroup key={item.id} item={item} onNavigate={onNavigate} />
          }
          return (
            <NavLink key={item.id} to={item.to!} end={item.end} className={navClass} onClick={onNavigate}>
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          )
        })}
        <Link to="/" className={navClass({ isActive: false })} onClick={onNavigate}>
          <NavIcon name="store" />
          Storefront
        </Link>
      </nav>

      <div className="mt-auto space-y-3 border-t border-white/10 pt-5">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => {
            onNavigate?.()
            void logout()
          }}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 16l4-4-4-4M19 12H10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Logout
        </button>
        <p className="px-3 text-[11px] leading-relaxed text-white/45">
          {now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          <span className="mt-1 block">Nexora Admin v1.0</span>
        </p>
      </div>
    </div>
  )
}

function TopBar() {
  const { profile, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const initial = (profile?.full_name || profile?.email || 'A').trim().charAt(0).toUpperCase()

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-3 md:px-6">
      <div>
        <p className="text-sm font-semibold text-ink">Admin workspace</p>
        <p className="hidden text-xs text-ink-soft sm:block">Manage catalogue, stock, and store operations</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative flex size-10 items-center justify-center rounded-full border border-line bg-paper-2 text-ink-soft"
          aria-label="Notifications"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7Zm5 11a2 2 0 0 0 2 0" strokeLinecap="round" />
          </svg>
        </button>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            className="flex items-center gap-3 rounded-full border border-line bg-white py-1.5 pl-1.5 pr-3 text-left hover:bg-paper-2"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-pine text-sm font-semibold text-white">{initial}</span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-semibold text-ink">{profile?.email}</span>
              <span className="block text-xs capitalize text-ink-soft">{profile?.role?.replaceAll('_', ' ').toLowerCase()}</span>
            </span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
              <Link to="/admin/settings" className="block px-4 py-2 text-sm hover:bg-paper-2" onClick={() => setMenuOpen(false)}>
                Settings
              </Link>
              <button type="button" className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-paper-2" onClick={() => void logout()}>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  return (
    <AdminToastProvider>
      <div className="min-h-screen bg-[#f4f6f8] text-ink">
        <div className="flex min-h-screen">
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto bg-pine-2 p-5 md:block">
            <Sidebar />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white px-4 py-2 md:hidden">
              <button
                type="button"
                className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold"
                onClick={() => setOpen(true)}
              >
                Menu
              </button>
              <p className="text-sm font-semibold">Nexora Admin</p>
            </div>
            <TopBar />
            <main className="flex-1 p-4 md:p-6">
              <Outlet />
            </main>
          </div>
        </div>
        {open ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[min(18rem,100%)] bg-pine-2 p-5 shadow-xl">
              <Sidebar onNavigate={() => setOpen(false)} />
            </div>
          </div>
        ) : null}
      </div>
    </AdminToastProvider>
  )
}
