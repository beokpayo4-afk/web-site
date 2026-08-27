import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { ProductArt, ProductGrid } from '@/components/product/ProductCard'
import { QueryError, SectionHeader } from '@/components/storefront/Section'
import { EmptyState } from '@/components/ui/Card'
import { ProductGridSkeleton } from '@/components/ui/Skeleton'
import { buttonClassName } from '@/components/ui/buttonStyles'
import { formatMoney } from '@/lib/format'
import { catalogService, type ProductQuery } from '@/services/catalog'
import type { Product } from '@/types/api'

export function ProductSection({
  kicker,
  title,
  subtitle,
  to,
  query,
  spotlight = false,
}: {
  kicker: string
  title: string
  subtitle?: string
  to: string
  query: ProductQuery
  spotlight?: boolean
}) {
  const products = useQuery({
    queryKey: ['products', 'rail', title, query],
    queryFn: () => catalogService.products({ ...query, page: 1, page_size: spotlight ? 5 : 8 }),
  })
  const items = products.data?.results ?? []
  const lead = spotlight ? items[0] : undefined
  const rest = spotlight ? items.slice(1) : items

  return (
    <section>
      <SectionHeader kicker={kicker} title={title} subtitle={subtitle} to={to} action="Shop" />
      {products.isError ? <QueryError title={`${title} could not load`} onRetry={() => void products.refetch()} /> : null}
      {products.isLoading ? <ProductGridSkeleton count={spotlight ? 4 : 4} /> : null}
      {lead ? <SpotlightCard product={lead} /> : null}
      {rest.length ? (
        <div className={lead ? 'mt-4' : undefined}>
          <ProductGrid products={rest} />
        </div>
      ) : null}
      {products.isSuccess && items.length === 0 ? (
        <EmptyState title="Nothing in this row yet" body="Check back after the next merchandising pass." />
      ) : null}
    </section>
  )
}

function SpotlightCard({ product }: { product: Product }) {
  return (
    <article className="mb-1 grid overflow-hidden rounded-4xl border border-line bg-white md:grid-cols-2">
      <Link to={`/product/${product.slug}`} className="block">
        {product.primary_image ? (
          <img src={product.primary_image} alt={product.name} className="h-full max-h-112 w-full object-cover md:min-h-88" />
        ) : (
          <div className="h-full md:min-h-88">
            <ProductArt sku={product.sku} name={product.name} className="aspect-auto h-full min-h-88 rounded-none" />
          </div>
        )}
      </Link>
      <div className="flex flex-col justify-center p-6 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Editor’s pick</p>
        <Link to={`/product/${product.slug}`} className="mt-3 font-display text-3xl leading-tight hover:text-pine md:text-4xl">
          {product.name}
        </Link>
        <p className="mt-3 max-w-md text-ink-soft">{product.short_description}</p>
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <p className="text-2xl font-semibold">{formatMoney(product.selling_price)}</p>
            {product.discount_percent > 0 ? (
              <p className="text-sm text-ink-soft line-through">{formatMoney(product.mrp)}</p>
            ) : null}
          </div>
          <Link to={`/product/${product.slug}`} className={buttonClassName('primary')}>
            View piece
          </Link>
        </div>
      </div>
    </article>
  )
}
