import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { CatalogPagination } from '@/components/product/CatalogPagination'
import { ProductGrid } from '@/components/product/ProductCard'
import { QueryError } from '@/components/storefront/Section'
import { ShopFilters, ShopFiltersToggle, ShopSortBar } from '@/components/storefront/ShopFilters'
import { Button } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/Card'
import { ProductGridSkeleton } from '@/components/ui/Skeleton'
import { HOME_AISLES } from '@/content/aisles'
import { PAGE_SIZE, useProductQuery } from '@/hooks/useProductQuery'
import { catalogService } from '@/services/catalog'

function CatalogResults({
  title,
  kicker,
  intro,
  emptyTitle,
  emptyBody,
  categorySlug,
}: {
  title: string
  kicker: string
  intro?: string
  emptyTitle: string
  emptyBody: string
  categorySlug?: string
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const query = useProductQuery(categorySlug ? { category: categorySlug } : {})
  const products = useQuery({ queryKey: ['products', query], queryFn: () => catalogService.products(query) })
  const pageSize = query.page_size ?? PAGE_SIZE

  return (
    <div className="space-y-6">
      <PageHeader kicker={kicker} title={title} />
      {intro ? <p className="max-w-2xl text-ink-soft">{intro}</p> : null}
      <ShopFiltersToggle open={filtersOpen} onToggle={() => setFiltersOpen((value) => !value)} />
      <div className="grid gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <div className={filtersOpen ? 'block' : 'hidden lg:block'}>
          <ShopFilters lockedCategory={categorySlug} />
        </div>
        <div className="space-y-4">
          <ShopSortBar count={products.data?.count} />
          {products.isError ? (
            <QueryError title="Catalogue could not load" body="Check your connection and try again." onRetry={() => void products.refetch()} />
          ) : null}
          {products.isLoading ? <ProductGridSkeleton /> : null}
          {products.isSuccess && products.data.results.length ? (
            <>
              <ProductGrid products={products.data.results} />
              <CatalogPagination count={products.data.count} pageSize={pageSize} />
            </>
          ) : null}
          {products.isSuccess && products.data.results.length === 0 ? <EmptyState title={emptyTitle} body={emptyBody} /> : null}
        </div>
      </div>
    </div>
  )
}

export function ShopPage() {
  return (
    <CatalogResults
      kicker="Catalogue"
      title="Shop Nexora"
      intro="Search the live catalogue by name, SKU, brand, aisle, or tag. Filters and sorting run on the server."
      emptyTitle="No matches"
      emptyBody="Try another filter or search term."
    />
  )
}

export function CategoryPage({ slug }: { slug: string }) {
  const categories = useQuery({ queryKey: ['categories'], queryFn: catalogService.categories })
  const category = categories.data?.find((item) => item.slug === slug)
  const aisle = HOME_AISLES.find((item) => item.category === slug || item.id === slug)

  if (categories.isError) {
    return <QueryError title="This aisle could not load" onRetry={() => void categories.refetch()} />
  }

  if (categories.isSuccess && !category) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Category not found"
          body="That aisle is not in the current catalogue. Browse the full shop instead."
        />
        <Link to="/shop">
          <Button>Go to shop</Button>
        </Link>
      </div>
    )
  }

  return (
    <CatalogResults
      kicker={aisle?.eyebrow ?? 'Category'}
      title={aisle?.title ?? category?.name ?? 'Collection'}
      intro={category?.description || 'Pieces from this aisle of the Nexora catalogue.'}
      emptyTitle="Nothing here yet"
      emptyBody="This aisle is still being stocked."
      categorySlug={slug}
    />
  )
}

export function SearchPage() {
  const query = useProductQuery()
  return (
    <CatalogResults
      kicker="Search"
      title={query.search ? `Results for “${query.search}”` : 'Search the shop'}
      intro={
        query.search
          ? 'Matching names, SKUs, brands, aisles, descriptions, and tags from the live catalogue.'
          : 'Type a term in the header search, or use the filters to browse.'
      }
      emptyTitle="No results"
      emptyBody="Check the spelling or browse the full shop."
    />
  )
}
