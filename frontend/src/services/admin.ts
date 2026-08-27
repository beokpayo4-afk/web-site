import { api } from '@/lib/api'
import type { AdminProduct, Brand, Category, DashboardSummary, Order, Paginated, ProductImage, TaxClass } from '@/types/api'

export interface AdminListParams {
  search?: string
  page?: number
  page_size?: number
  status?: string
  is_active?: boolean | string
  is_featured?: boolean | string
  is_bestseller?: boolean | string
  category?: string | number
  brand?: string | number
  stock?: string
  ordering?: string
}

function cleanParams(params?: AdminListParams) {
  if (!params) return undefined
  const next: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    next[key] = value as string | number | boolean
  }
  return next
}

export const adminService = {
  summary() {
    return api.get<DashboardSummary>('/admin/summary/').then((r) => r.data)
  },
  products(params?: AdminListParams) {
    return api.get<Paginated<AdminProduct>>('/admin/products/', { params: cleanParams(params) }).then((r) => r.data)
  },
  product(id: number) {
    return api.get<AdminProduct>(`/admin/products/${id}/`).then((r) => r.data)
  },
  createProduct(payload: Record<string, unknown>) {
    return api.post<AdminProduct>('/admin/products/', payload).then((r) => r.data)
  },
  updateProduct(id: number, payload: Record<string, unknown>) {
    return api.patch<AdminProduct>(`/admin/products/${id}/`, payload).then((r) => r.data)
  },
  deactivateProduct(id: number) {
    return api.delete(`/admin/products/${id}/`)
  },
  setProductStatus(id: number, action: 'publish' | 'unpublish' | 'draft') {
    return api.post<AdminProduct>(`/admin/products/${id}/status/`, { action }).then((r) => r.data)
  },
  uploadProductImage(productId: number, file: File, extras?: { alt_text?: string; is_primary?: boolean }) {
    const form = new FormData()
    form.append('image', file)
    if (extras?.alt_text) form.append('alt_text', extras.alt_text)
    if (extras?.is_primary) form.append('is_primary', 'true')
    return api.post<ProductImage>(`/admin/products/${productId}/images/`, form).then((r) => r.data)
  },
  updateProductImage(productId: number, imageId: number, payload: Partial<ProductImage>) {
    return api.patch<ProductImage>(`/admin/products/${productId}/images/${imageId}/`, payload).then((r) => r.data)
  },
  deleteProductImage(productId: number, imageId: number) {
    return api.delete(`/admin/products/${productId}/images/${imageId}/`)
  },
  categories(params?: AdminListParams) {
    return api.get<Paginated<Category>>('/admin/categories/', { params: cleanParams(params) }).then((r) => r.data)
  },
  brands(params?: AdminListParams) {
    return api.get<Paginated<Brand>>('/admin/brands/', { params: cleanParams(params) }).then((r) => r.data)
  },
  taxClasses() {
    return api.get<TaxClass[]>('/admin/tax-classes/').then((r) => r.data)
  },
  orders(params?: AdminListParams & { payment_status?: string }) {
    return api.get<Paginated<Order>>('/admin/orders/', { params: cleanParams(params) }).then((r) => r.data)
  },
  order(id: number) {
    return api.get<Order>(`/admin/orders/${id}/`).then((r) => r.data)
  },
  updateOrderStatus(id: number, status: string) {
    return api.post<Order>(`/admin/orders/${id}/status/`, { status }).then((r) => r.data)
  },
}
