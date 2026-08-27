import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { HOME_AISLES, HOME_MOSAIC } from '@/content/aisles'
import { productTone } from '@/lib/format'
import { catalogService } from '@/services/catalog'

export function CategorySection() {
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
      <section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_MOSAIC.map((tile) => {
            const photo = photoFor(tile.category)
            const [from, to] = productTone(tile.id)
            return (
              <Link key={tile.id} to={tile.to} className="group relative min-h-52 overflow-hidden rounded-lg">
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${from}, ${to})` }} />
                )}
                <div className="absolute inset-0 bg-ink/45" />
                <div className="relative flex h-full min-h-52 flex-col justify-end p-5 text-white">
                  <p className="text-sm text-white/80">{tile.eyebrow}</p>
                  <p className="font-display text-3xl leading-none">{tile.title}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em]">{tile.tag}</p>
                  <span className="mt-4 text-sm font-semibold underline-offset-4 group-hover:underline">Browse</span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section>
        <div className="grid gap-3 md:grid-cols-2">
          {HOME_AISLES.map((aisle) => {
            const photo = photoFor(aisle.category)
            const [from, to] = productTone(aisle.id)
            return (
              <Link key={aisle.id} to={aisle.to} className="group relative min-h-80 overflow-hidden rounded-lg">
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${from}, ${to})` }} />
                )}
                <div className="absolute inset-0 bg-ink/50" />
                <div className="relative flex h-full min-h-80 flex-col justify-end p-6 text-white md:p-8">
                  <p className="text-sm text-white/80">{aisle.eyebrow}</p>
                  <p className="font-display text-4xl leading-none md:text-5xl">{aisle.title}</p>
                  <p className="mt-3 text-sm font-semibold uppercase tracking-[0.22em]">{aisle.tag}</p>
                  <span className="mt-5 text-sm font-semibold underline-offset-4 group-hover:underline">Browse</span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
