import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { type ProductQuery } from '@/services/catalog'

export const PAGE_SIZE = 12

export function useProductQuery(overrides: ProductQuery = {}) {
  const [params] = useSearchParams()
  const search = params.get('q') ?? undefined
  const category = params.get('category') ?? overrides.category
  const brand = params.get('brand') ?? undefined
  const ordering = params.get('ordering') ?? (search ? 'relevance' : 'relevance')
  const availability = params.get('availability') ?? undefined
  const inStock = params.get('in_stock') === 'true' || undefined
  const featured = params.get('featured') === 'true' || overrides.featured
  const bestseller = params.get('bestseller') === 'true' || overrides.bestseller
  const onSale = params.get('on_sale') === 'true' || undefined
  const minPrice = params.get('min_price') ?? undefined
  const maxPrice = params.get('max_price') ?? undefined
  const minRating = params.get('min_rating') ?? undefined
  const minDiscount = params.get('min_discount') ?? undefined
  const tag = params.get('tag') ?? undefined
  const page = Number(params.get('page') ?? 1)
  const pageSize = Number(params.get('page_size') ?? PAGE_SIZE)
  return useMemo<ProductQuery>(
    () => ({
      search,
      category,
      brand,
      ordering,
      availability,
      in_stock: inStock,
      featured: featured || undefined,
      bestseller: bestseller || undefined,
      on_sale: onSale,
      min_price: minPrice,
      max_price: maxPrice,
      min_rating: minRating,
      min_discount: minDiscount,
      tag,
      page,
      page_size: pageSize,
    }),
    [
      availability,
      bestseller,
      brand,
      category,
      featured,
      inStock,
      maxPrice,
      minDiscount,
      minPrice,
      minRating,
      onSale,
      ordering,
      page,
      pageSize,
      search,
      tag,
    ],
  )
}
