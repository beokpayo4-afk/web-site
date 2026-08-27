import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { formatMoney } from '@/lib/format'
import { catalogService } from '@/services/catalog'

export function Hero() {
  const starter = useQuery({
    queryKey: ['products', 'from-30'],
    queryFn: () => catalogService.products({ ordering: 'selling_price', in_stock: true, page_size: 1 }),
  })
  const product = starter.data?.results[0]
  const fromPrice = product ? formatMoney(product.selling_price) : '₹30'

  return (
    <div>
      <section className="grid min-h-128rflow-hidden bg-pine text-paper lg:min-h-144 lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-paper/70">Nexora</p>
          <h1 className="mt-5 font-display text-4xl leading-[1.02] sm:text-5xl md:text-6xl">
            Your one-stop shop for
            <span className="mt-2 block text-clay">tech essentials</span>
            <span className="block">&amp; compact homes</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-paper/80">
            Audio, charging, accessories, and storage from the original Nexora list. Starting from {fromPrice}. GST on
            the invoice.
          </p>
          <div className="mt-8">
            <Link to="/shop?ordering=selling_price">
              <Button className="rounded-md px-10 py-3">Shop from {fromPrice}</Button>
            </Link>
          </div>
        </div>
        <div className="relative min-h-72 bg-pine-2">
          {product?.primary_image ? (
            <img src={product.primary_image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full min-h-72 bg-clay/40" />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(31,77,58,0.55), transparent 55%)' }} />
        </div>
      </section>
      <div className="bg-clay px-6 py-10 text-white sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/75">Limited time</p>
            <p className="mt-2 font-display text-4xl leading-none md:text-6xl">Starting from {fromPrice}</p>
            <p className="mt-3 text-sm font-medium tracking-wide text-white/90">
              {product ? `${product.name} · Electronics sale` : 'Electronics sale'}
            </p>
          </div>
          <Link to="/shop?ordering=selling_price">
            <Button className="rounded-md bg-white px-8 text-clay hover:bg-paper">Shop from {fromPrice}</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
