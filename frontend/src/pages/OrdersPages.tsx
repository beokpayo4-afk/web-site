import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { OrderStatusBadge, OrderTimeline, PaymentStatusBadge } from '@/components/orders/OrderStatus'
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

  return (
    <div className="space-y-6">
      <PageHeader kicker={data.order_number} title={formatStatus(data.status)}>
        <PaymentStatusBadge status={data.payment_status} />
      </PageHeader>
      <OrderTimeline status={data.status} />

      <Card>
        <h2 className="font-semibold">Items</h2>
        {data.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-3 py-2 text-sm">
            <span>
              {item.product_name} × {item.quantity}
              <span className="mt-0.5 block text-xs text-ink-soft">SKU {item.sku}</span>
            </span>
            <span>{formatMoney(item.line_total)}</span>
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
            Order payment status: <span className="font-semibold">{formatStatus(data.payment_status)}</span>
          </p>
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

      {data.shipment ? (
        <Card>
          <h2 className="font-semibold">Shipment tracking</h2>
          <p className="mt-2 text-sm">
            {data.shipment.carrier} · {data.shipment.tracking_number}
          </p>
          <p className="text-sm text-ink-soft">{formatStatus(data.shipment.status)}</p>
          {data.shipment.estimated_delivery ? (
            <p className="text-sm text-ink-soft">Estimated delivery {formatDate(data.shipment.estimated_delivery)}</p>
          ) : null}
          {data.shipment.tracking_events.length ? (
            <ol className="mt-4 space-y-3 border-l border-line pl-4">
              {data.shipment.tracking_events.map((event) => (
                <li key={`${event.at}-${event.status}`}>
                  <p className="text-sm font-semibold">{formatStatus(event.status)}</p>
                  <p className="text-sm text-ink-soft">{event.note}</p>
                  <p className="text-xs text-ink-soft">{formatDate(event.at)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">Tracking updates will appear here once the parcel moves.</p>
          )}
        </Card>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}
      {data.cancellable ? (
        <Button
          variant="danger"
          disabled={pending}
          onClick={async () => {
            try {
              setError('')
              setPending(true)
              await commerceService.cancelOrder(data.id)
              await queryClient.invalidateQueries({ queryKey: ['order', id] })
              await queryClient.invalidateQueries({ queryKey: ['orders'] })
            } catch (err) {
              setError(getErrorMessage(err, 'This order could not be cancelled.'))
            } finally {
              setPending(false)
            }
          }}
        >
          {pending ? 'Cancelling…' : 'Cancel order'}
        </Button>
      ) : null}
      <Link to="/account/orders" className="inline-block text-sm font-semibold text-pine">
        Back to orders
      </Link>
    </div>
  )
}

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
