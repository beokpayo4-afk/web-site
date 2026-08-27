import type { Role } from '@/types/api'

export type AdminArea = 'dashboard' | 'products' | 'categories' | 'brands' | 'orders' | 'settings' | 'profile'

const ROLE_AREAS: Record<string, AdminArea[]> = {
  SUPER_ADMIN: ['dashboard', 'products', 'categories', 'brands', 'orders', 'settings', 'profile'],
  PRODUCT_MANAGER: ['dashboard', 'products', 'categories', 'brands', 'settings', 'profile'],
  INVENTORY_MANAGER: ['dashboard', 'products', 'settings', 'profile'],
  ORDER_MANAGER: ['dashboard', 'orders', 'settings', 'profile'],
  CUSTOMER_SUPPORT: ['dashboard', 'orders', 'settings', 'profile'],
}

export function canAccess(role: Role | string | undefined, area: AdminArea) {
  if (!role) return false
  return (ROLE_AREAS[role] ?? []).includes(area)
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
}

export type AdminNavChild = {
  id: string
  label: string
  to: string
  /** Exact status filter; omit for All Orders */
  status?: string
}

export type AdminNavItem = {
  id: string
  label: string
  to?: string
  area: AdminArea
  end?: boolean
  icon: 'dashboard' | 'products' | 'add' | 'orders' | 'settings' | 'store'
  children?: AdminNavChild[]
}

export const ORDER_STATUS_FILTERS: AdminNavChild[] = [
  { id: 'all', label: 'All Orders', to: '/admin/orders' },
  { id: 'pending', label: 'Pending', to: '/admin/orders?status=PENDING', status: 'PENDING' },
  { id: 'processing', label: 'Processing', to: '/admin/orders?status=PROCESSING', status: 'PROCESSING' },
  { id: 'shipped', label: 'Shipped', to: '/admin/orders?status=SHIPPED', status: 'SHIPPED' },
  { id: 'delivered', label: 'Delivered', to: '/admin/orders?status=DELIVERED', status: 'DELIVERED' },
  { id: 'cancelled', label: 'Cancelled', to: '/admin/orders?status=CANCELLED', status: 'CANCELLED' },
]

export const ADMIN_NAV: AdminNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', to: '/admin', area: 'dashboard', end: true, icon: 'dashboard' },
  { id: 'products', label: 'Products', to: '/admin/products', area: 'products', end: true, icon: 'products' },
  { id: 'add-product', label: 'Add Product', to: '/admin/products/new', area: 'products', icon: 'add' },
  { id: 'orders', label: 'Orders', area: 'orders', icon: 'orders', children: ORDER_STATUS_FILTERS },
  { id: 'settings', label: 'Settings', to: '/admin/settings', area: 'settings', icon: 'settings' },
]
