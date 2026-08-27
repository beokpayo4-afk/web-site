import { api } from '@/lib/api'
import type { Brand, Category, Paginated, Product, ProductFacets, Review, ReviewEligibility } from '@/types/api'

export interface ProductQuery {
  search?: string
  category?: string
  brand?: string
  min_price?: string
  max_price?: string
  featured?: boolean
  bestseller?: boolean
  in_stock?: boolean
  availability?: string
  min_rating?: string
  on_sale?: boolean
  min_discount?: string
  tag?: string
  ordering?: string
  page?: number
  page_size?: number
}

function compactParams(params: ProductQuery) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== false),
  )
}

export const catalogService = {
  categories() {
    return api.get<Category[]>('/categories/').then((r) => r.data)
  },
  brands() {
    return api.get<Brand[]>('/brands/').then((r) => r.data)
  },
  products(params: ProductQuery) {
    return api.get<Paginated<Product>>('/products/', { params: compactParams(params) }).then((r) => r.data)
  },
  facets(params: ProductQuery) {
    return api.get<ProductFacets>('/products/facets/', { params: compactParams(params) }).then((r) => r.data)
  },
  product(slug: string) {
    return api.get<Product>(`/products/${slug}/`).then((r) => r.data)
  },
  reviews(productId: number) {
    return api.get<Paginated<Review>>(`/products/${productId}/reviews/`).then((r) => r.data)
  },
  reviewEligibility(productId: number) {
    return api.get<ReviewEligibility>(`/products/${productId}/review-eligibility/`).then((r) => r.data)
  },
  myReviews() {
    return api.get<Paginated<Review>>('/reviews/me/').then((r) => r.data)
  },
  createReview(productId: number, payload: { rating: number; title: string; body: string }) {
    return api.post<Review>(`/products/${productId}/reviews/`, payload).then((r) => r.data)
  },
}
