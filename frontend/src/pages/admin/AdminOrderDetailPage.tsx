import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AdminPage } from '@/components/admin/AdminPage'
import { OrderStatusBadge, OrderTimeline, PaymentStatusBadge } from '@/components/orders/OrderStatus'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import { useAdminToast } from '@/hooks/admin-toast-context'
import { getErrorMessage } from '@/lib/api'
import { formatDate, formatMoney, formatStatus } from '@/lib/format'
import { adminService } from '@/services/admin'
import type { Address } from '@/types/api'

function AddressBlock({ title, address }: { title: string; address: Address }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed">
        {address.full_name}
        <br />
        {address.line1}
        {address.line2 ? (
          <>
            <br />
            {address.line2}
          </>
        ) : null}
        <br />
        {address.city}, {address.state} {address.postal_code}
        <br />
        {address.phone}
      </p>
    </div>
  )
}

export function AdminOrderDetailPage() {
  const { id = '' } = useParams()
  const toast = useAdminToast()
  const queryClient = useQueryClient()
  const order = useQuery({ queryKey: ['admin-order', id], queryFn: () => adminService.order(Number(id)) })
  const [nextStatus, setNextStatus] = useState('')

  const updateStatus = useMutation({
    mutationFn: (status: string) => adminService.updateOrderStatus(Number(id), status),
    onSuccess: async (data) => {
      toast.push(`Order moved to ${formatStatus(data.status)}.`)
      setNextStatus('')
      await queryClient.invalidateQueries({ queryKey: ['admin-order', id] })
      await queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-summary'] })
    },
    onError: (err) => toast.push(getErrorMessage(err, 'Could not update order status.'), 'error'),
  })

  const data = order.data
  const options = data?.next_statuses ?? []
  const selectedStatus = nextStatus || options[0] || ''

  return (
    <AdminPage
      title={data ? data.order_number : 'Order'}
      error={order.error}
      actions={
        <Link to="/admin/orders">
          <Button variant="ghost">Back to orders</Button>
        </Link>
      }
    >
      {order.isLoading ? <p className="text-sm text-ink-soft">Loading order…</p> : null}

      {order.isError && !data ? (
        <p className="text-sm text-ink-soft">
          Could not load order details. Confirm the API is running and{' '}
          <code className="rounded bg-paper-2 px-1">VITE_API_URL</code> points to your backend.
        </p>
      ) : null}

      {data ? (
        <div className="space-y-5">
          <Card className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={data.status} />
                <PaymentStatusBadge status={data.payment_status} />
              </div>
              <p className="text-sm text-ink-soft">Placed {formatDate(data.created_at)}</p>
              <p className="text-sm">
                <span className="text-ink-soft">Customer:</span>{' '}
                <span className="font-semibold">{data.customer_name || '—'}</span>
                {data.customer_email ? <span className="text-ink-soft"> · {data.customer_email}</span> : null}
              </p>
            </div>
            <p className="font-display text-3xl">{formatMoney(data.grand_total)}</p>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl">Fulfilment</h2>
              {data ? (
                <p className="text-sm text-ink-soft">
                  Current: <span className="font-semibold text-ink">{formatStatus(data.status)}</span>
                </p>
              ) : null}
            </div>
            <OrderTimeline status={data.status} />
            {options.length ? (
              <div className="space-y-3 border-t border-line pt-4">
                <p className="text-sm text-ink-soft">Move this order to the next step in fulfilment.</p>
                <div className="flex flex-wrap items-end gap-3">
                  <Select
                    label="Update status"
                    value={selectedStatus}
                    onChange={(event) => setNextStatus(event.target.value)}
                    className="min-w-48"
                  >
                    {options.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={updateStatus.isPending || !selectedStatus}
                    onClick={() => updateStatus.mutate(selectedStatus)}
                  >
                    {updateStatus.isPending ? 'Updating…' : 'Apply status'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="border-t border-line pt-4 text-sm text-ink-soft">
                No further status transitions for <span className="font-semibold text-ink">{formatStatus(data.status)}</span>.
                {data.status === 'REFUNDED' || data.status === 'CANCELLED'
                  ? ' This order is closed.'
                  : ' Refresh the page if you expected more options.'}
              </p>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <AddressBlock title="Shipping" address={data.shipping_address} />
            </Card>
            <Card>
              <AddressBlock title="Billing" address={data.billing_address} />
            </Card>
          </div>

          <Card className="space-y-3">
            <h2 className="font-display text-xl">Items</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="pb-2 font-semibold">Product</th>
                    <th className="pb-2 font-semibold">Qty</th>
                    <th className="pb-2 font-semibold">Unit</th>
                    <th className="pb-2 font-semibold">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="border-t border-line/70">
                      <td className="py-2">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="font-mono text-xs text-ink-soft">{item.sku}</p>
                      </td>
                      <td className="py-2">{item.quantity}</td>
                      <td className="py-2">{formatMoney(item.unit_price)}</td>
                      <td className="py-2 font-semibold">{formatMoney(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="grid gap-2 border-t border-line pt-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd>{formatMoney(data.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Discount</dt>
                <dd>{formatMoney(data.discount_amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Tax</dt>
                <dd>{formatMoney(data.tax_amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Shipping</dt>
                <dd>{formatMoney(data.shipping_amount)}</dd>
              </div>
              <div className="flex justify-between gap-3 font-semibold sm:col-span-2">
                <dt>Grand total</dt>
                <dd>{formatMoney(data.grand_total)}</dd>
              </div>
            </dl>
            {data.customer_notes ? (
              <p className="rounded-xl bg-paper-2 px-3 py-2 text-sm">
                <span className="font-semibold">Notes:</span> {data.customer_notes}
              </p>
            ) : null}
          </Card>
        </div>
      ) : null}
    </AdminPage>
  )
}
