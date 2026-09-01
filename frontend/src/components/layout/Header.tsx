import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { SearchForm } from '@/components/storefront/SearchForm'
import { HOME_AISLES } from '@/content/aisles'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'

const primaryLinks = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'text-pine' : 'text-ink-soft hover:text-ink'
}

function ElectronicsMenu() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 ${open ? 'text-pine' : 'text-ink-soft hover:text-ink'}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        Electronics
        <span aria-hidden className="text-[0.65rem] leading-none">
          ▼
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 min-w-56 rounded-xl border border-line bg-white py-2 shadow-lg">
          {HOME_AISLES.map((aisle) => (
            <Link
              key={aisle.id}
              to={aisle.to}
              className="block px-4 py-2 text-sm text-ink-soft hover:bg-paper-2 hover:text-ink"
              onClick={() => setOpen(false)}
            >
              {aisle.navLabel}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function Header() {
  const { isAuthenticated, isStaff, profile, logout } = useAuth()
  const { count } = useCart()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [menuLocation, setMenuLocation] = useState(location.key)
  if (menuLocation !== location.key) {
    setMenuLocation(location.key)
    setOpen(false)
  }
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [open])

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <p className="bg-pine px-4 py-2 text-center text-xs font-medium text-paper">
        Original Nexora catalogue · Starting from ₹30 · Free shipping
      </p>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="shrink-0 font-display text-2xl text-pine">
          Nexora
        </Link>
        <SearchForm className="hidden flex-1 md:block" />
        <nav className="ml-auto hidden items-center gap-5 text-sm font-medium md:flex" aria-label="Account">
          {isStaff ? (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          ) : (
            <NavLink to={isAuthenticated ? '/account/settings' : '/login'} className={navClass}>
              {isAuthenticated ? 'Settings' : 'Sign in'}
            </NavLink>
          )}
          {isAuthenticated ? (
            <button type="button" onClick={() => void logout()} className="text-ink-soft hover:text-ink">
              Sign out
            </button>
          ) : null}
          <NavLink to="/cart" className={navClass}>
            Cart{count ? ` (${count})` : ''}
          </NavLink>
        </nav>
        <NavLink to="/cart" className="ml-auto text-sm font-medium md:hidden" aria-label={count ? `Cart, ${count} items` : 'Cart'}>
          Cart{count ? ` (${count})` : ''}
        </NavLink>
        <button
          type="button"
          className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      <SearchForm id="mobile-site-search" className="px-4 pb-3 md:hidden" />

      <nav className="hidden border-t border-line md:block" aria-label="Primary">
        <div className="mx-auto flex max-w-6xl items-center gap-7 px-4 py-2.5 text-sm font-medium">
          {primaryLinks.slice(0, 2).map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={navClass}>
              {link.label}
            </NavLink>
          ))}
          <ElectronicsMenu />
          {primaryLinks.slice(2).map((link) => (
            <NavLink key={link.to} to={link.to} className={navClass}>
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="absolute inset-y-0 right-0 flex w-[min(22rem,100%)] flex-col overflow-y-auto bg-paper shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-display text-xl text-pine">Nexora</p>
              <button
                ref={closeButtonRef}
                type="button"
                className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="space-y-5 px-4 py-5">
              <p className="text-sm text-ink-soft">{profile?.full_name ?? 'Guest'}</p>
              <SearchForm id="drawer-search" className="w-full" onSubmitSuccess={() => setOpen(false)} />
              <nav aria-label="Mobile">
                <ul className="space-y-1">
                  {primaryLinks.map((link) => (
                    <li key={link.to}>
                      <NavLink to={link.to} end={link.to === '/'} className="block rounded-xl px-3 py-2.5 text-base hover:bg-paper-2" onClick={() => setOpen(false)}>
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                  <li>
                    <NavLink to="/cart" className="block rounded-xl px-3 py-2.5 text-base hover:bg-paper-2" onClick={() => setOpen(false)}>
                      Cart{count ? ` (${count})` : ''}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to={isStaff ? '/admin' : isAuthenticated ? '/account/settings' : '/login'}
                      className="block rounded-xl px-3 py-2.5 text-base hover:bg-paper-2"
                      onClick={() => setOpen(false)}
                    >
                      {isStaff ? 'Admin' : isAuthenticated ? 'Settings' : 'Sign in'}
                    </NavLink>
                  </li>
                </ul>
              </nav>
              <nav aria-label="Electronics">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-clay">Electronics</p>
                <ul className="space-y-1">
                  {HOME_AISLES.map((aisle) => (
                    <li key={aisle.id}>
                      <Link
                        to={aisle.to}
                        className="block rounded-xl px-3 py-2 text-sm hover:bg-paper-2"
                        onClick={() => setOpen(false)}
                      >
                        {aisle.navLabel}
                        <span className="mt-0.5 block text-xs uppercase tracking-[0.14em] text-ink-soft">{aisle.tag}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              {isAuthenticated ? (
                <button type="button" className="text-sm font-semibold text-ink-soft" onClick={() => void logout()}>
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}

export function MobileCartBar() {
  const { count } = useCart()
  if (!count) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white p-3 md:hidden">
      <Link to="/cart" className="flex items-center justify-between rounded-full bg-clay px-5 py-3 text-sm font-semibold text-white">
        <span>View cart</span>
        <span>
          {count} item{count === 1 ? '' : 's'}
        </span>
      </Link>
    </div>
  )
}
