import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { formatMoney, formatShipping } from '@/lib/format'
import { commerceService } from '@/services/commerce'

export function CartPage() {
  const { isAuthenticated } = useAuth()
  const cart = useCart()
  const items = cart.data?.items ?? []
  const quote = useQuery({
    queryKey: ['cart-quote', cart.data?.updated_at],
    queryFn: () => commerceService.quote('Chhattisgarh'),
    enabled: isAuthenticated && items.length > 0,
  })

  if (!isAuthenticated) {
    return (
      <EmptyState title="Sign in to see your cart" body="Your bag is stored against your account so it follows you across devices." />
    )
  }

  const lineBySku = new Map((quote.data?.lines ?? []).map((line) => [line.sku, line]))
  const subtotal = items.reduce((sum, item) => sum + Number(item.product.selling_price) * item.quantity, 0)

  return (
    <div>
      <PageHeader kicker="Bag" title="Your cart" />
      {items.length === 0 ? (
        <EmptyState title="Your cart is empty" body="Browse the shop and add something considered." />
      ) : (
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            {items.map((item) => {
              const line = lineBySku.get(item.product.sku)
              const excl = Number(item.product.selling_price) * item.quantity
              return (
                <div key={item.id} className="flex gap-4 rounded-2xl border border-line bg-white p-4">
                  <div className="flex-1">
                    <Link to={`/product/${item.product.slug}`} className="font-semibold">
                      {item.product.name}
                    </Link>
                    <p className="text-sm text-ink-soft">{formatMoney(item.product.selling_price)} each, before GST</p>
                    {line ? (
                      <p className="mt-1 text-sm">
                        {formatMoney(line.line_total)} incl. GST
                        <span className="text-ink-soft"> ({formatMoney(line.tax_amount)} GST)</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-ink-soft">{formatMoney(excl)} before GST</p>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <label className="text-sm">
                        Qty
                        <input
                          type="number"
                          min={1}
                          max={item.product.stock_quantity}
                          value={item.quantity}
                          className="ml-2 w-16 rounded-lg border border-line px-2 py-1"
                          onChange={(event) => cart.update.mutate({ id: item.id, quantity: Number(event.target.value) })}
                        />
                      </label>
                      <button type="button" className="text-sm text-red-700" onClick={() => cart.remove.mutate(item.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <aside className="h-fit rounded-2xl bg-pine p-5 text-paper">
            <p className="text-sm text-paper/70">Total with GST</p>
            <p className="text-3xl font-semibold">
              {formatMoney(quote.data?.grand_total ?? subtotal)}
            </p>
            <dl className="mt-4 space-y-2 text-sm text-paper/85">
              <div className="flex justify-between gap-3">
                <dt>Subtotal</dt>
                <dd>{formatMoney(quote.data?.subtotal ?? subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>GST</dt>
                <dd>{quote.data ? formatMoney(quote.data.tax_amount) : 'Calculated at checkout'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Shipping</dt>
                <dd>{quote.data ? formatShipping(quote.data.shipping_amount) : 'Free'}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-paper/70">
              GST is 18% on electronics. Shipping is free. Totals come from the server, not the product card.
            </p>
            <Link to="/checkout" className="mt-4 block">
              <Button className="w-full">Checkout</Button>
            </Link>
          </aside>
        </div>
      )}
    </div>
  )
}
