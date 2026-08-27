import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/OrderStatus'
import { QueryError } from '@/components/storefront/Section'
import { Button } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/Card'
import { formatMoney } from '@/lib/format'
import { commerceService } from '@/services/commerce'

export function OrderSuccessPage() {
  const { id = '' } = useParams()
  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => commerceService.order(Number(id)),
    enabled: Boolean(id) && !Number.isNaN(Number(id)),
  })

  if (order.isLoading) return <p className="text-sm text-ink-soft">Loading your order…</p>
  if (order.isError) {
    return (
      <QueryError
        title="We could not open this order"
        body="Sign in with the account that placed it, or check the link."
        onRetry={() => void order.refetch()}
      />
    )
  }
  if (!order.data) {
    return <EmptyState title="Order not found" body="Return to your account to see recent orders." />
  }

  const data = order.data

  return (
    <div className="mx-auto max-w-xl text-center">
      <PageHeader kicker="Confirmed" title="Payment verified" />
      <div className="mb-4 flex justify-center gap-2">
        <OrderStatusBadge status={data.status} />
      </div>
      <PaymentStatusBadge status={data.payment_status} />
      <p className="mt-4 text-ink-soft">
        Order {data.order_number} is on file. GST, discount, and shipping were calculated on the server and the payment
        signature was checked before stock was committed.
      </p>
      <p className="mt-4 text-2xl font-semibold">{formatMoney(data.grand_total)}</p>
      {data.shipment ? (
        <p className="mt-2 text-sm text-ink-soft">Tracking {data.shipment.tracking_number}</p>
      ) : null}
      <div className="mt-6 flex justify-center gap-3">
        <Link to={`/account/orders/${id}`}>
          <Button>View order</Button>
        </Link>
        <Link to="/shop">
          <Button variant="ghost">Continue shopping</Button>
        </Link>
      </div>
    </div>
  )
}
