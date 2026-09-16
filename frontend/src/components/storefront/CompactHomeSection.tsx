import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'

import { Magnetic, easeLux } from '@/components/motion/Motion'
import { ProductGrid } from '@/components/product/ProductCard'
import { QueryError, SectionHeader } from '@/components/storefront/Section'
import { Button } from '@/components/ui/Button'
import { ProductGridSkeleton } from '@/components/ui/Skeleton'
import { catalogService } from '@/services/catalog'

export function CompactHomeSection() {
  const reduce = useReducedMotion()
  const kitchen = useQuery({
    queryKey: ['products', 'compact-home'],
    queryFn: () => catalogService.products({ category: 'kitchen', page_size: 4 }),
  })
  const extras = useQuery({
    queryKey: ['products', 'home-air'],
    queryFn: () => catalogService.products({ category: 'home-appliances', page_size: 4 }),
  })
  const items = [...(kitchen.data?.results ?? []), ...(extras.data?.results ?? [])].slice(0, 4)
  const hero = items[0]

  return (
    <section className="space-y-6">
      <div className="grid overflow-hidden rounded-lg bg-paper-2 md:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-10 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-clay">Premium quality</p>
          <h2 className="mt-2 font-display text-4xl leading-none md:text-6xl">Small kitchen</h2>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-ink-soft">Luxurisse compact home</p>
          <p className="mt-4 max-w-md text-ink-soft">
            Kettles, mixers, irons, and slim fans from the Luxurisse list — still under ₹1,000, still GST on the invoice.
          </p>
          <Magnetic className="mt-6 inline-block" strength={14}>
            <Link to="/shop">
              <Button className="rounded-md">Shop home kit</Button>
            </Link>
          </Magnetic>
        </div>
        <div className="relative min-h-56 overflow-hidden bg-mist">
          {hero?.primary_image ? (
            <motion.img
              src={hero.primary_image}
              alt=""
              className="h-full w-full object-cover"
              initial={reduce ? false : { scale: 1.08 }}
              whileInView={reduce ? undefined : { scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: easeLux }}
            />
          ) : null}
        </div>
      </div>
      {kitchen.isError || extras.isError ? (
        <QueryError title="Home kit could not load" onRetry={() => void kitchen.refetch()} />
      ) : null}
      {kitchen.isLoading ? <ProductGridSkeleton count={4} /> : null}
      {items.length ? (
        <>
          <SectionHeader kicker="Kitchen essentials" title="Home kit sale" to="/shop" action="Shop" />
          <ProductGrid products={items} />
        </>
      ) : null}
    </section>
  )
}
