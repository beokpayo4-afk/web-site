import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import {
  OrderStatusBadge,
  OrderTrackingCard,
  PaymentStatusBadge,
} from '@/components/orders/OrderStatus'
import { CatalogPagination } from '@/components/product/CatalogPagination'
import { QueryError } from '@/components/storefront/Section'
import { Button } from '@/components/ui/Button'
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Card'
import { getErrorMessage } from '@/lib/api'
import { formatDate, formatMoney, formatShipping, formatStatus } from '@/lib/format'
import { commerceService } from '@/services/commerce'
import type { Address } from '@/types/api'

export function OrdersPage() {
  const [params] = useSearchParams()
  const page = Number(params.get('page') ?? 1)
  const orders = useQuery({ queryKey: ['orders', page], queryFn: () => commerceService.orders(page) })

  return (
    <div>
      <PageHeader kicker="Orders" title="Order history" />
      {orders.isError ? <QueryError title="Orders could not load" onRetry={() => void orders.refetch()} /> : null}
      {orders.isLoading ? <p className="text-sm text-ink-soft">Loading orders…</p> : null}
      {orders.isSuccess && orders.data.results.length === 0 ? (
        <EmptyState title="No orders yet" body="When you check out, they will appear here." />
      ) : null}
      {orders.data?.results.length ? (
        <div className="space-y-3">
          {orders.data.results.map((order) => (
            <Link key={order.id} to={`/account/orders/${order.id}`} className="block rounded-2xl border border-line bg-white p-4 hover:border-pine">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{order.order_number}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.payment_status} />
                    <span>{formatDate(order.created_at)}</span>
                  </p>
                </div>
                <p className="font-semibold">{formatMoney(order.grand_total)}</p>
              </div>
            </Link>
          ))}
          <CatalogPagination count={orders.data.count} />
        </div>
      ) : null}
    </div>
  )
}

export function OrderDetailsPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const order = useQuery({ queryKey: ['order', id], queryFn: () => commerceService.order(Number(id)) })
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelOther, setCancelOther] = useState('')

  if (order.isLoading) return <p className="text-sm text-ink-soft">Loading order…</p>
  if (order.isError) {
    return (
      <QueryError
        title="This order could not load"
        body="It may not exist, or it belongs to another account."
        onRetry={() => void order.refetch()}
      />
    )
  }
  if (!order.data) {
    return <EmptyState title="Order not found" body="Check the link or return to your order history." />
  }

  const data = order.data
  const shipping = data.shipping_address
  const paymentNote = data.customer_notes?.startsWith('Payment method:')
    ? data.customer_notes.replace(/^Payment method:\s*/, '')
    : null
  const resolvedReason = cancelReason === 'Other' ? cancelOther.trim() : cancelReason

  async function submitCancel() {
    if (resolvedReason.length < 3) {
      setError('Please choose or enter a cancellation reason.')
      return
    }
    try {
      setError('')
      setPending(true)
      await commerceService.cancelOrder(data.id, resolvedReason)
      setCancelOpen(false)
      setCancelReason('')
      setCancelOther('')
      setPending(false)
      void queryClient.invalidateQueries({ queryKey: ['order', id] })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
    } catch (err) {
      setError(getErrorMessage(err, 'This order could not be cancelled.'))
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader kicker={data.order_number} title={formatStatus(data.status)}>
        <PaymentStatusBadge status={data.payment_status} />
      </PageHeader>

      <OrderTrackingCard order={data} />

      <Card>
        <h2 className="font-semibold">Items</h2>
        {data.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-3 border-b border-line py-3 text-sm last:border-0">
            <span>
              {item.product_name} × {item.quantity}
              <span className="mt-0.5 block text-xs text-ink-soft">SKU {item.sku}</span>
            </span>
            <span className="font-medium">{formatMoney(item.line_total)}</span>
          </div>
        ))}
        <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMoney(data.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Discount</dt>
            <dd>-{formatMoney(data.discount_amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>GST</dt>
            <dd>{formatMoney(data.tax_amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>{formatShipping(data.shipping_amount)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(data.grand_total)}</dd>
          </div>
        </dl>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Delivery address</h2>
          <AddressBlock address={shipping} />
        </Card>
        <Card>
          <h2 className="font-semibold">Payment</h2>
          <p className="mt-2 text-sm">
            Status: <span className="font-semibold">{formatStatus(data.payment_status)}</span>
          </p>
          {paymentNote ? <p className="mt-1 text-sm text-ink-soft">Method: {paymentNote}</p> : null}
          {data.payments.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {data.payments.map((payment) => (
                <li key={payment.id} className="rounded-xl bg-paper-2 p-3">
                  <p className="font-medium">
                    {payment.provider} · {formatStatus(payment.status)}
                  </p>
                  <p className="text-ink-soft">
                    {formatMoney(payment.amount)}
                    {payment.paid_at ? ` · paid ${formatDate(payment.paid_at)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">No payment attempts recorded.</p>
          )}
        </Card>
      </div>

      {data.status === 'CANCELLED' && data.cancel_reason ? (
        <Card>
          <h2 className="font-semibold">Cancellation reason</h2>
          <p className="mt-2 text-sm text-ink-soft">{data.cancel_reason}</p>
        </Card>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}
      {data.cancellable ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              setError('')
              setCancelOpen(true)
            }}
          >
            Cancel order
          </Button>
        </div>
      ) : null}

      {cancelOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center"
          role="presentation"
          onClick={() => !pending && setCancelOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-order-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="cancel-order-title" className="font-display text-xl">
              Why cancel this order?
            </h2>
            <p className="mt-1 text-sm text-ink-soft">Tell us the reason so we can improve your next order.</p>
            <div className="mt-4 space-y-2">
              {CANCEL_REASONS.map((reason) => (
                <label key={reason} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm hover:bg-paper-2">
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={reason}
                    checked={cancelReason === reason}
                    onChange={() => setCancelReason(reason)}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
            {cancelReason === 'Other' ? (
              <textarea
                className="mt-3 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-pine"
                rows={3}
                placeholder="Share a short reason…"
                value={cancelOther}
                onChange={(event) => setCancelOther(event.target.value)}
              />
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="danger" disabled={pending || resolvedReason.length < 3} onClick={() => void submitCancel()}>
                {pending ? 'Cancelling…' : 'Confirm cancellation'}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setCancelOpen(false)}>
                Keep order
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Link to="/account/orders" className="inline-block text-sm font-semibold text-pine">
        Back to orders
      </Link>
    </div>
  )
}

const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Delivery taking too long',
  'Need to change address or items',
  'Changed my mind',
  'Other',
] as const

function AddressBlock({ address }: { address: Partial<Address> | null }) {
  if (!address) return <p className="mt-2 text-sm text-ink-soft">No address on this order.</p>
  return (
    <p className="mt-2 text-sm leading-6 text-ink-soft">
      {address.full_name}
      <br />
      {address.line1}
      {address.line2 ? `, ${address.line2}` : ''}
      <br />
      {address.city}, {address.state} {address.postal_code}
      <br />
      {address.country}
      {address.phone ? (
        <>
          <br />
          {address.phone}
        </>
      ) : null}
    </p>
  )
}
