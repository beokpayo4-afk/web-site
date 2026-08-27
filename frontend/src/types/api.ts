export type Role =
  | 'SUPER_ADMIN'
  | 'PRODUCT_MANAGER'
  | 'ORDER_MANAGER'
  | 'INVENTORY_MANAGER'
  | 'CUSTOMER_SUPPORT'
  | 'CUSTOMER'

export interface User {
  id: number
  email: string
  phone: string
  role: Role
  full_name: string
  is_active?: boolean
  date_joined?: string
  order_count?: number
}

export interface Profile {
  id: number
  email: string
  full_name: string
  phone: string
  date_of_birth: string | null
  role: Role
}

export interface Address {
  id: number
  label: string
  full_name: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
  address_type: string
  is_default: boolean
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string
  parent: number | null
  is_active?: boolean
  sort_order?: number
}

export interface Brand {
  id: number
  name: string
  slug: string
  description: string
  is_active?: boolean
}

export interface TaxClass {
  id: number
  name: string
  hsn_sac_code: string
  cgst_rate: string
  sgst_rate: string
  igst_rate: string
}

export interface ProductImage {
  id: number
  image: string
  alt_text: string
  is_primary: boolean
  sort_order?: number
}

export interface Product {
  id: number
  name: string
  sku: string
  slug: string
  short_description: string
  description?: string
  mrp: string
  selling_price: string
  discount_percent: number
  discount_amount: string
  stock_quantity: number
  category: Category
  brand: Brand | null
  is_featured: boolean
  is_bestseller: boolean
  is_active?: boolean
  in_wishlist?: boolean
  average_rating: number | null
  review_count: number
  primary_image: string | null
  tags?: string[]
  images?: ProductImage[]
  tax_class?: TaxClass
  specifications?: Record<string, string | number | boolean>
  created_at?: string
  updated_at?: string
}

export interface CatalogFacet {
  slug: string
  name: string
  count: number
}

export interface ProductFacets {
  count: number
  min_price: string | null
  max_price: string | null
  categories: CatalogFacet[]
  brands: CatalogFacet[]
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CartItem {
  id: number
  product: Product
  quantity: number
}

export interface Cart {
  id: number
  items: CartItem[]
  updated_at: string
}

export interface OrderItem {
  id: number
  product: number
  product_name: string
  sku: string
  quantity: number
  unit_price: string
  mrp: string
  tax_rate: string
  tax_amount: string
  line_total: string
}

export interface Order {
  id: number
  order_number: string
  status: string
  payment_status: string
  cancellable: boolean
  next_statuses?: string[]
  customer_id?: number
  customer_email?: string
  customer_phone?: string
  customer_name?: string
  shipping_address: Address
  billing_address: Address
  subtotal: string
  discount_amount: string
  tax_amount: string
  shipping_amount: string
  grand_total: string
  customer_notes: string
  items: OrderItem[]
  payments: { id: number; provider: string; amount: string; status: string; provider_payment_id: string; paid_at: string | null }[]
  shipment: {
    id?: number
    order?: number
    order_number?: string
    carrier: string
    tracking_number: string
    status: string
    estimated_delivery: string | null
    shipped_at: string | null
    delivered_at: string | null
    tracking_events: { at: string; status: string; note: string }[]
  } | null
  created_at: string
  payment?: {
    provider_payment_id: string
    amount: string
    provider: string
    status: string
  }
}

export interface Quote {
  subtotal: string
  discount_amount: string
  tax_amount: string
  shipping_amount: string
  grand_total: string
  coupon_code?: string | null
  shipping_state?: string
  lines?: {
    product_id: number
    name: string
    sku: string
    quantity: number
    unit_price: string
    mrp: string
    tax_rate: string
    tax_amount: string
    discount_share: string
    line_total: string
  }[]
}

export interface Review {
  id: number
  product: number
  product_name?: string
  product_slug?: string
  user_name: string
  rating: number
  title: string
  body: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  is_approved: boolean
  is_verified_purchase: boolean
  is_mine?: boolean
  moderation_note?: string
  created_at: string
}

export interface ReviewEligibility {
  can_review: boolean
  reason: 'unauthenticated' | 'already_reviewed' | 'not_purchased' | 'eligible'
  review: Review | null
}

export interface WishlistItem {
  id: number
  product: Product
  added_at: string
}

export interface NotificationItem {
  id: number
  title: string
  message: string
  link: string
  is_read: boolean
  created_at: string
}

export interface AuthResponse {
  access: string
  refresh: string
  user: User
}

export interface ApiError {
  success: false
  error: {
    status: number
    message: string
    details?: unknown
  }
}

export interface DashboardSummary {
  orders: number
  paid_orders: number
  pending_orders: number
  delivered_orders: number
  customers: number
  products: number
  low_stock: number
  pending_reviews: number
  open_tickets: number
  revenue: string
  today_revenue: string
  recent_orders: {
    id: number
    order_number: string
    status: string
    payment_status: string
    grand_total: string
    customer_email: string
    created_at: string
  }[]
  best_selling_products: {
    product_id: number
    product_name: string
    sku: string
    units: number
    revenue: string
  }[]
  low_stock_products: {
    id: number
    product_id: number
    sku: string
    name: string
    quantity: number
    available_quantity: number
    low_stock_threshold: number
  }[]
  sales_overview: { day: string; orders: number; revenue: string }[]
  recent_customers: {
    id: number
    email: string
    full_name: string
    date_joined: string
    is_active: boolean
  }[]
}

export interface InventoryRow {
  id: number
  product: number
  sku: string
  name: string
  quantity: number
  reserved_quantity: number
  available_quantity: number
  low_stock_threshold: number
  warehouse_code: string
}

export interface Coupon {
  id: number
  code: string
  description: string
  discount_type: 'PERCENT' | 'FLAT'
  value: string
  min_order_amount: string
  max_discount_amount: string | null
  usage_limit: number | null
  usage_limit_per_user: number
  starts_at: string
  ends_at: string
  is_active: boolean
}

export interface AdminProduct {
  id: number
  name: string
  sku: string
  slug: string
  description: string
  short_description: string
  mrp: string
  selling_price: string
  discount_percent: number
  discount_amount: string
  tax_class: number
  tax_class_name: string
  gst_rate?: string
  gst_amount?: string
  category: number
  category_name: string
  brand: number | null
  brand_name: string
  specifications: Record<string, string | number | boolean>
  tags: string[]
  stock_quantity: number
  low_stock_threshold?: number
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock'
  images: ProductImage[]
  primary_image?: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED'
  is_active: boolean
  is_featured: boolean
  is_bestseller: boolean
  created_at: string
  updated_at: string
}

export interface AdminReports {
  daily: { day: string; orders: number; revenue: string }[]
  top_products: { items__product_id: number; items__product_name: string; items__sku: string; units: number; revenue: string }[]
  status_breakdown: { status: string; count: number }[]
}

export interface ContactTicket {
  id: number
  name: string
  email: string
  subject: string
  message: string
  is_resolved: boolean
  created_at: string
}

export interface ShipmentRow {
  id: number
  order: number
  order_number: string
  carrier: string
  tracking_number: string
  status: string
  estimated_delivery: string | null
  shipped_at: string | null
  delivered_at: string | null
  tracking_events: { at: string; status: string; note: string }[]
}
