import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'

import { Button } from '@/components/ui/Button'
import { formatMoney } from '@/lib/format'
import { catalogService } from '@/services/catalog'

const ease = [0.22, 1, 0.36, 1] as const

export function Hero() {
  const reduce = useReducedMotion()
  const starter = useQuery({
    queryKey: ['products', 'from-30'],
    queryFn: () => catalogService.products({ ordering: 'selling_price', in_stock: true, page_size: 1 }),
  })
  const product = starter.data?.results[0]
  const fromPrice = product ? formatMoney(product.selling_price) : '₹30'

  return (
    <div>
      <section className="grid min-h-128 overflow-hidden bg-pine text-paper lg:min-h-144 lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
          <motion.p
            className="text-sm font-semibold uppercase tracking-[0.28em] text-paper/70"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
          >
            Nexora
          </motion.p>
          <motion.h1
            className="mt-5 font-display text-4xl leading-[1.02] sm:text-5xl md:text-6xl"
            initial={reduce ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease }}
          >
            Your one-stop shop for
            <span className="mt-2 block text-clay">tech essentials</span>
            <span className="block">&amp; compact homes</span>
          </motion.h1>
          <motion.p
            className="mt-6 max-w-md text-lg text-paper/80"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18, ease }}
          >
            Audio, charging, accessories, and storage from the original Nexora list. Starting from {fromPrice}. GST on
            the invoice.
          </motion.p>
          <motion.div
            className="mt-8"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28, ease }}
          >
            <Link to="/shop?ordering=selling_price">
              <Button className="rounded-md px-10 py-3">Shop from {fromPrice}</Button>
            </Link>
          </motion.div>
        </div>
        <motion.div
          className="relative min-h-72 bg-pine-2"
          initial={reduce ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease }}
        >
          {product?.primary_image ? (
            <img src={product.primary_image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full min-h-72 bg-clay/40" />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(31,77,58,0.55), transparent 55%)' }} />
        </motion.div>
      </section>
      <motion.div
        className="bg-clay px-6 py-10 text-white sm:px-10"
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.55, ease }}
      >
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
      </motion.div>
    </div>
  )
}
