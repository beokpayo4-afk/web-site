import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'

import { Stagger, StaggerItem } from '@/components/motion/Motion'
import { buttonClassName } from '@/components/ui/buttonStyles'
import { Badge } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { formatMoney, productTone } from '@/lib/format'
import type { Product } from '@/types/api'

export function ProductArt({ sku, name, className = '' }: { sku: string; name: string; className?: string }) {
  const [from, to] = productTone(sku)
  return (
    <div
      className={`relative flex items-end overflow-hidden rounded-2xl p-4 text-white ${className || 'aspect-square'}`}
      style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full opacity-30">
        <circle cx="150" cy="40" r="50" fill="white" />
        <rect x="10" y="110" width="90" height="70" rx="18" fill="white" />
      </svg>
      <span className="relative text-sm font-semibold">{name.split(' ')[0]}</span>
    </div>
  )
}

export function ProductCard({ product }: { product: Product }) {
  const { isAuthenticated } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const inStock = product.stock_quantity > 0

  function addToCart() {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/product/${product.slug}` } })
      return
    }
    cart.add.mutate({ productId: product.id })
  }

  return (
    <motion.article
      className="flex h-full flex-col rounded-xl border border-line bg-white p-3"
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ duration: 0.25 }}
    >
      <Link to={`/product/${product.slug}`} className="block overflow-hidden rounded-lg focus-visible:outline-offset-4">
        {product.primary_image ? (
          <motion.img
            src={product.primary_image}
            alt={product.name}
            className="aspect-square w-full object-cover"
            whileHover={reduce ? undefined : { scale: 1.04 }}
            transition={{ duration: 0.4 }}
          />
        ) : (
          <ProductArt sku={product.sku} name={product.name} />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 px-1 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-clay">{product.category.name}</p>
        <Link to={`/product/${product.slug}`} className="font-medium leading-snug text-ink hover:text-pine">
          {product.name}
        </Link>
        {product.average_rating ? (
          <p className="text-xs text-ink-soft">
            {product.average_rating.toFixed(1)} · {product.review_count} {product.review_count === 1 ? 'review' : 'reviews'}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {product.discount_percent > 0 ? <Badge>{product.discount_percent}% off</Badge> : null}
        </div>
        <div className="mt-auto pt-2">
          <p className="text-lg font-semibold">{formatMoney(product.selling_price)}</p>
          {product.discount_percent > 0 ? (
            <p className="text-xs text-ink-soft line-through">{formatMoney(product.mrp)}</p>
          ) : null}
          <p className="text-xs text-ink-soft">{inStock ? 'GST on the invoice' : 'Out of stock'}</p>
          <button
            type="button"
            className={`${buttonClassName('primary', 'mt-3 w-full rounded-md')} shrink-0`}
            disabled={!inStock || cart.add.isPending}
            onClick={addToCart}
          >
            {cart.add.isPending ? 'Adding…' : 'Add to cart'}
          </button>
        </div>
      </div>
    </motion.article>
  )
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <StaggerItem key={product.id} className="h-full">
          <ProductCard product={product} />
        </StaggerItem>
      ))}
    </Stagger>
  )
}
