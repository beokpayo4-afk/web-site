import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ProductArt, ProductGrid } from '@/components/product/ProductCard'
import { QueryError, SectionHeader } from '@/components/storefront/Section'
import { Button } from '@/components/ui/Button'
import { Alert, Badge, Card, EmptyState } from '@/components/ui/Card'
import { Input, TextArea } from '@/components/ui/Input'
import { ProductDetailsSkeleton, ProductGridSkeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { getErrorMessage } from '@/lib/api'
import { formatDate, formatMoney, formatStatus } from '@/lib/format'
import { catalogService } from '@/services/catalog'
import { commerceService } from '@/services/commerce'

export function ProductDetailsPage() {
  const { slug = '' } = useParams()
  const productQuery = useQuery({ queryKey: ['product', slug], queryFn: () => catalogService.product(slug) })
  const product = productQuery.data
  const images = useMemo(() => product?.images ?? [], [product])
  const [activeImage, setActiveImage] = useState(0)
  const reviews = useQuery({
    queryKey: ['reviews', product?.id],
    queryFn: () => catalogService.reviews(product!.id),
    enabled: Boolean(product),
  })
  const related = useQuery({
    queryKey: ['products', 'related', product?.category.slug],
    queryFn: () => catalogService.products({ category: product!.category.slug, page: 1, page_size: 5 }),
    enabled: Boolean(product),
  })
  const { isAuthenticated } = useAuth()
  const cart = useCart()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [wishMessage, setWishMessage] = useState('')
  const wishlist = useQuery({
    queryKey: ['wishlist'],
    queryFn: commerceService.wishlist,
    enabled: isAuthenticated,
  })
  const eligibility = useQuery({
    queryKey: ['review-eligibility', product?.id],
    queryFn: () => catalogService.reviewEligibility(product!.id),
    enabled: Boolean(product) && isAuthenticated,
  })
  const savedItem = wishlist.data?.find((item) => item.product.id === product?.id)

  if (productQuery.isLoading) return <ProductDetailsSkeleton />
  if (productQuery.isError) {
    return (
      <QueryError
        title="This product could not load"
        body="It may be unpublished, or the connection dropped."
        onRetry={() => void productQuery.refetch()}
      />
    )
  }
  if (!product) {
    return <EmptyState title="Product unavailable" body="This listing is no longer in the catalogue." />
  }

  const gallery = images.length
    ? images
    : product.primary_image
      ? [{ id: 0, image: product.primary_image, alt_text: product.name, is_primary: true }]
      : []
  const current = gallery[Math.min(activeImage, Math.max(gallery.length - 1, 0))]
  const gst = product.tax_class
    ? Number(product.tax_class.cgst_rate) + Number(product.tax_class.sgst_rate) || Number(product.tax_class.igst_rate)
    : null
  const relatedItems = (related.data?.results ?? []).filter((item) => item.id !== product.id).slice(0, 4)

  return (
    <div className="space-y-16">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          {current ? (
            <img src={current.image} alt={current.alt_text || product.name} className="w-full rounded-4xl object-cover" />
          ) : (
            <ProductArt sku={product.sku} name={product.name} />
          )}
          {gallery.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {gallery.map((image, index) => (
                <button
                  key={image.id || index}
                  type="button"
                  className={`overflow-hidden rounded-xl border ${index === activeImage ? 'border-pine' : 'border-line'}`}
                  aria-label={`Show image ${index + 1}`}
                  aria-pressed={index === activeImage}
                  onClick={() => setActiveImage(index)}
                >
                  <img src={image.image} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <p className="text-sm text-ink-soft">
            <Link to={`/category/${product.category.slug}`} className="hover:text-pine">
              {product.category.name}
            </Link>{' '}
            · {product.brand?.name ?? 'Nexora'} · SKU {product.sku}
          </p>
          <h1 className="mt-2 font-display text-4xl">{product.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.is_featured ? <Badge>Featured</Badge> : null}
            {product.is_bestseller ? <Badge>Bestseller</Badge> : null}
            {product.discount_percent > 0 ? <Badge>{product.discount_percent}% off</Badge> : null}
          {(product.tags ?? []).slice(0, 4).map((tag) => (
            <Link key={tag} to={`/search?q=${encodeURIComponent(tag)}`}>
              <Badge>{tag}</Badge>
            </Link>
          ))}
          </div>
          <p className="mt-4 text-ink-soft">{product.short_description}</p>
          <div className="mt-5 flex items-end gap-3">
            <p className="text-3xl font-semibold">{formatMoney(product.selling_price)}</p>
            {product.discount_percent > 0 ? <p className="text-ink-soft line-through">{formatMoney(product.mrp)}</p> : null}
          </div>
          {gst ? <p className="mt-1 text-sm text-ink-soft">Inclusive of GST ({gst}%)</p> : null}
          <p className="mt-2 text-sm">{product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Currently unavailable'}</p>
          {error ? (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              disabled={product.stock_quantity < 1 || cart.add.isPending}
              onClick={async () => {
                if (!isAuthenticated) {
                  setError('Sign in to add items to your cart.')
                  return
                }
                try {
                  setError('')
                  await cart.add.mutateAsync({ productId: product.id, quantity: 1 })
                } catch (err) {
                  setError(getErrorMessage(err, 'Could not add to cart.'))
                }
              }}
            >
              {cart.add.isPending ? 'Adding…' : 'Add to cart'}
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                if (!isAuthenticated) {
                  setError('Sign in to save a wishlist.')
                  return
                }
                try {
                  setError('')
                  if (savedItem) {
                    await commerceService.removeWishlist(savedItem.id)
                    setWishMessage('Removed from wishlist.')
                  } else {
                    await commerceService.addWishlist(product.id)
                    setWishMessage('Saved to wishlist.')
                  }
                  await queryClient.invalidateQueries({ queryKey: ['wishlist'] })
                  await queryClient.invalidateQueries({ queryKey: ['product', slug] })
                } catch (err) {
                  setError(getErrorMessage(err, 'Could not update your wishlist.'))
                }
              }}
            >
              {savedItem ? 'Saved' : 'Save'}
            </Button>
          </div>
          {wishMessage ? <p className="mt-2 text-sm text-good">{wishMessage}</p> : null}
          <p className="mt-6 whitespace-pre-line text-sm leading-6">{product.description}</p>
          {product.specifications ? (
            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-paper-2 p-3">
                  <dt className="text-ink-soft">{key}</dt>
                  <dd className="font-medium">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>

      <section>
        <h2 className="font-display text-2xl">Reviews</h2>
        {reviews.isError ? <div className="mt-4"><QueryError title="Reviews could not load" onRetry={() => void reviews.refetch()} /></div> : null}
        {reviews.isLoading ? <p className="mt-4 text-sm text-ink-soft">Loading reviews…</p> : null}
        {reviews.isSuccess && reviews.data.results.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {reviews.data.results.map((review) => (
              <Card key={review.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{review.title}</p>
                  {review.is_mine && review.status !== 'APPROVED' ? (
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{formatStatus(review.status)}</span>
                  ) : null}
                </div>
                <p className="text-sm text-ink-soft">
                  {review.rating}/5 · {review.user_name} · {formatDate(review.created_at)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {review.is_verified_purchase ? <Badge>Verified purchase</Badge> : null}
                </div>
                <p className="mt-2 text-sm">{review.body}</p>
                {review.is_mine && review.status === 'PENDING' ? (
                  <p className="mt-2 text-xs text-ink-soft">Your review is waiting for moderation.</p>
                ) : null}
                {review.is_mine && review.status === 'REJECTED' && review.moderation_note ? (
                  <p className="mt-2 text-xs text-ink-soft">{review.moderation_note}</p>
                ) : null}
              </Card>
            ))}
          </div>
        ) : null}
        {reviews.isSuccess && reviews.data.results.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">No reviews yet. Be the first after delivery.</p>
        ) : null}
        {isAuthenticated ? (
          <ReviewForm productId={product.id} eligibility={eligibility.data} />
        ) : (
          <p className="mt-4 text-sm">
            <Link to="/login" className="font-semibold text-pine underline">
              Sign in
            </Link>{' '}
            to write a review after a delivered purchase.
          </p>
        )}
      </section>

      <section>
        <SectionHeader kicker="More from this aisle" title="You might also like" to={`/category/${product.category.slug}`} action="View all" />
        {related.isError ? <QueryError title="Related products could not load" onRetry={() => void related.refetch()} /> : null}
        {related.isLoading ? <ProductGridSkeleton count={4} /> : null}
        {relatedItems.length ? <ProductGrid products={relatedItems} /> : null}
        {related.isSuccess && relatedItems.length === 0 ? (
          <EmptyState title="No neighbours yet" body="This is currently the only piece in the aisle." />
        ) : null}
      </section>
    </div>
  )
}

function ReviewForm({
  productId,
  eligibility,
}: {
  productId: number
  eligibility?: { can_review: boolean; reason: string }
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: (payload: { rating: number; title: string; body: string }) => catalogService.createReview(productId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] })
      queryClient.invalidateQueries({ queryKey: ['review-eligibility', productId] })
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
    },
  })
  if (eligibility && !eligibility.can_review) {
    const copy =
      eligibility.reason === 'already_reviewed'
        ? 'You have already reviewed this product. Check Settings for its moderation status.'
        : 'You can review this product after a delivered purchase.'
    return <p className="mt-6 text-sm text-ink-soft">{copy}</p>
  }
  return (
    <form
      className="mt-6 grid max-w-xl gap-3"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        try {
          setError('')
          await mutation.mutateAsync({
            rating: Number(form.get('rating')),
            title: String(form.get('title')),
            body: String(form.get('body')),
          })
          event.currentTarget.reset()
        } catch (err) {
          setError(getErrorMessage(err, 'Could not submit review.'))
        }
      }}
    >
      <h3 className="font-semibold">Write a review</h3>
      <p className="text-xs text-ink-soft">Reviews are published after moderation. Verified purchases are labelled.</p>
      {error ? <Alert>{error}</Alert> : null}
      <Input name="rating" label="Rating (1-5)" type="number" min={1} max={5} defaultValue={5} required />
      <Input name="title" label="Title" required />
      <TextArea name="body" label="Your review" required />
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Submitting…' : 'Submit review'}
      </Button>
    </form>
  )
}
