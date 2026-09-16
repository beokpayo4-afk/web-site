import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'

import { SpotlightCard, Stagger, StaggerItem, easeLux } from '@/components/motion/Motion'
import { HOME_AISLES, HOME_MOSAIC } from '@/content/aisles'
import { productTone } from '@/lib/format'
import { catalogService } from '@/services/catalog'

export function CategorySection() {
  const reduce = useReducedMotion()
  const listing = useQuery({
    queryKey: ['products', 'aisle-art'],
    queryFn: () => catalogService.products({ page: 1, page_size: 18 }),
  })
  const items = listing.data?.results ?? []
  const used = new Set<string>()

  function photoFor(category: string | null) {
    const match = items.find((product) => {
      const image = product.primary_image
      if (!image || used.has(image)) return false
      if (!category) return !['audio', 'charging', 'storage'].includes(product.category.slug)
      return product.category.slug === category
    })
    if (match?.primary_image) used.add(match.primary_image)
    return match?.primary_image
  }

  return (
    <div className="space-y-4">
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" delay={0.09}>
        {HOME_MOSAIC.map((tile) => {
          const photo = photoFor(tile.category)
          const [from, to] = productTone(tile.id)
          return (
            <StaggerItem key={tile.id}>
              <SpotlightCard className="rounded-lg">
                <Link to={tile.to} className="group relative block min-h-52 overflow-hidden rounded-lg">
                  {photo ? (
                    <motion.img
                      src={photo}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      whileHover={reduce ? undefined : { scale: 1.1 }}
                      transition={{ duration: 0.7, ease: easeLux }}
                    />
                  ) : (
                    <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${from}, ${to})` }} />
                  )}
                  <div className="absolute inset-0 bg-ink/45 transition duration-500 group-hover:bg-ink/35" />
                  <div className="relative flex h-full min-h-52 flex-col justify-end p-5 text-white">
                    <p className="text-sm text-white/80">{tile.eyebrow}</p>
                    <p className="font-display text-3xl leading-none">{tile.title}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em]">{tile.tag}</p>
                    <motion.span
                      className="mt-4 inline-flex text-sm font-semibold"
                      whileHover={reduce ? undefined : { x: 6 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    >
                      Browse →
                    </motion.span>
                  </div>
                </Link>
              </SpotlightCard>
            </StaggerItem>
          )
        })}
      </Stagger>

      <Stagger className="grid gap-3 md:grid-cols-2" delay={0.12}>
        {HOME_AISLES.map((aisle) => {
          const photo = photoFor(aisle.category)
          const [from, to] = productTone(aisle.id)
          return (
            <StaggerItem key={aisle.id}>
              <SpotlightCard className="rounded-lg">
                <Link to={aisle.to} className="group relative block min-h-80 overflow-hidden rounded-lg">
                  {photo ? (
                    <motion.img
                      src={photo}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      whileHover={reduce ? undefined : { scale: 1.08 }}
                      transition={{ duration: 0.85, ease: easeLux }}
                    />
                  ) : (
                    <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${from}, ${to})` }} />
                  )}
                  <div className="absolute inset-0 bg-ink/50 transition duration-500 group-hover:bg-ink/40" />
                  <div className="relative flex h-full min-h-80 flex-col justify-end p-6 text-white md:p-8">
                    <p className="text-sm text-white/80">{aisle.eyebrow}</p>
                    <p className="font-display text-4xl leading-none md:text-5xl">{aisle.title}</p>
                    <p className="mt-3 text-sm font-semibold uppercase tracking-[0.22em]">{aisle.tag}</p>
                    <span className="mt-5 text-sm font-semibold underline-offset-4 group-hover:underline">Browse</span>
                  </div>
                </Link>
              </SpotlightCard>
            </StaggerItem>
          )
        })}
      </Stagger>
    </div>
  )
}
