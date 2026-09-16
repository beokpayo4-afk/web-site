import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'

import { Magnetic, Parallax, TextReveal, easeLux } from '@/components/motion/Motion'
import { Button } from '@/components/ui/Button'
import { formatMoney } from '@/lib/format'
import { catalogService } from '@/services/catalog'

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
      <section className="relative grid min-h-128 overflow-hidden bg-pine text-paper lg:min-h-144 lg:grid-cols-2">
        {!reduce ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-clay/25 blur-3xl"
            animate={{ x: [0, 40, 0], y: [0, 24, 0], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : null}
        {!reduce ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-1/3 size-80 rounded-full bg-paper/10 blur-3xl"
            animate={{ x: [0, -30, 0], y: [0, -20, 0], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          />
        ) : null}

        <div className="relative z-10 flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
          <motion.div
            initial={reduce ? false : { opacity: 0, letterSpacing: '0.45em' }}
            animate={{ opacity: 1, letterSpacing: '0.28em' }}
            transition={{ duration: 0.9, ease: easeLux }}
          >
            <TextReveal
              text="LUXURISSE PRIVATE LIMITED"
              className="text-sm font-semibold uppercase tracking-[0.28em] text-paper/70"
              delay={0.05}
            />
          </motion.div>

          <h1 className="mt-5 font-display text-4xl leading-[1.02] sm:text-5xl md:text-6xl">
            <TextReveal text="Your one-stop shop for" delay={0.18} className="block" />
            <motion.span
              className="mt-2 block text-clay"
              initial={reduce ? false : { opacity: 0, y: 28, clipPath: 'inset(0 100% 0 0)' }}
              animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0)' }}
              transition={{ duration: 0.85, delay: 0.42, ease: easeLux }}
            >
              tech essentials
            </motion.span>
            <motion.span
              className="block"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.58, ease: easeLux }}
            >
              &amp; compact homes
            </motion.span>
          </h1>

          <motion.p
            className="mt-6 max-w-md text-lg text-paper/80"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.72, ease: easeLux }}
          >
            Audio, charging, accessories, and storage from the Luxurisse catalogue. Starting from {fromPrice}. GST on
            the invoice.
          </motion.p>

          <motion.div
            className="mt-8"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.86, ease: easeLux }}
          >
            <Magnetic strength={22} className="inline-block">
              <Link to="/shop?ordering=selling_price">
                <Button className="rounded-md px-10 py-3 transition-transform will-change-transform hover:scale-[1.03] active:scale-[0.98]">
                  Shop from {fromPrice}
                </Button>
              </Link>
            </Magnetic>
          </motion.div>
        </div>

        <div className="relative min-h-72 overflow-hidden bg-pine-2">
          <Parallax className="absolute inset-0 h-[115%] w-full" offset={64}>
            {product?.primary_image ? (
              <motion.img
                src={product.primary_image}
                alt={product.name}
                className="h-full w-full object-cover"
                initial={reduce ? false : { scale: 1.12 }}
                animate={reduce ? undefined : { scale: [1.12, 1.04, 1.08] }}
                transition={{ duration: 18, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
              />
            ) : (
              <div className="h-full min-h-72 bg-clay/40" />
            )}
          </Parallax>
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(90deg, rgba(31,77,58,0.55), transparent 55%)' }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/10 to-transparent"
            initial={false}
            animate={reduce ? undefined : { x: ['-120%', '220%'] }}
            transition={{ duration: 4.5, repeat: Infinity, repeatDelay: 3.5, ease: 'easeInOut' }}
          />
        </div>
      </section>

      <motion.div
        className="overflow-hidden bg-clay px-6 py-10 text-white sm:px-10"
        initial={reduce ? false : { opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: easeLux }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/75">Limited time</p>
            <motion.p
              className="mt-2 font-display text-4xl leading-none md:text-6xl"
              initial={reduce ? false : { opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1, ease: easeLux }}
            >
              Starting from {fromPrice}
            </motion.p>
            <p className="mt-3 text-sm font-medium tracking-wide text-white/90">
              {product ? `${product.name} · Electronics sale` : 'Electronics sale'}
            </p>
          </div>
          <Magnetic strength={16}>
            <Link to="/shop?ordering=selling_price">
              <Button className="rounded-md bg-white px-8 text-clay hover:bg-paper">Shop from {fromPrice}</Button>
            </Link>
          </Magnetic>
        </div>
      </motion.div>
    </div>
  )
}
