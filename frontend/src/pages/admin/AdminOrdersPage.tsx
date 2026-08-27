import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import { AdminPage } from '@/components/admin/AdminPage'
import { AdminTable, AdminToolbar } from '@/components/admin/AdminTable'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/OrderStatus'
import { CatalogPagination } from '@/components/product/CatalogPagination'
import { Input, Select } from '@/components/ui/Input'
import { ORDER_STATUS_FILTERS } from '@/lib/adminAccess'
import { formatDate, formatMoney, formatStatus } from '@/lib/format'
import { adminService } from '@/services/admin'

const PAGE_SIZE = 20

const TITLE_BY_STATUS: Record<string, string> = {
  '': 'All Orders',
  PENDING: 'Pending Orders',
  PROCESSING: 'Processing Orders',
  SHIPPED: 'Shipped Orders',
  DELIVERED: 'Delivered Orders',
  CANCELLED: 'Cancelled Orders',
}

export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const page = Number(params.get('page') ?? 1)
  const status = params.get('status') ?? ''
  const paymentStatus = params.get('payment_status') ?? ''
  const ordering = params.get('ordering') ?? '-created_at'

  const orders = useQuery({
    queryKey: ['admin-orders', search, page, status, paymentStatus, ordering],
    queryFn: () =>
      adminService.orders({
        search: search || undefined,
        page,
        page_size: PAGE_SIZE,
        status: status || undefined,
        payment_status: paymentStatus || undefined,
        ordering,
      }),
  })

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  const rows = orders.data?.results ?? []
  const title = TITLE_BY_STATUS[status] ?? `${formatStatus(status)} Orders`

  return (
    <AdminPage title={title} error={orders.error}>
      <AdminToolbar>
        <Input
          label="Search order or customer"
          value={search}
          onChange={(event) => update('search', event.target.value)}
          placeholder="Order number, email…"
          className="min-w-56"
        />
        <Select label="Status" value={status} onChange={(event) => update('status', event.target.value)}>
          {ORDER_STATUS_FILTERS.map((filter) => (
            <option key={filter.id} value={filter.status ?? ''}>
              {filter.label}
            </option>
          ))}
        </Select>
        <Select label="Payment" value={paymentStatus} onChange={(event) => update('payment_status', event.target.value)}>
          <option value="">All payments</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </Select>
        <Select label="Sort" value={ordering} onChange={(event) => update('ordering', event.target.value)}>
          <option value="-created_at">Newest</option>
          <option value="created_at">Oldest</option>
          <option value="-grand_total">Total ↓</option>
          <option value="grand_total">Total ↑</option>
        </Select>
      </AdminToolbar>

      {orders.isLoading ? <p className="text-sm text-ink-soft">Loading orders…</p> : null}
      {!orders.isLoading && rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-sm text-ink-soft">No orders match these filters.</p>
      ) : null}

      {rows.length ? (
        <>
          <AdminTable columns={['Order', 'Customer', 'Status', 'Payment', 'Total', 'Placed', '']}>
            {rows.map((order) => (
              <tr key={order.id} className="border-b border-line/70 align-top last:border-0">
                <td className="px-3 py-3">
                  <Link to={`/admin/orders/${order.id}`} className="font-semibold text-pine">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium">{order.customer_name || '—'}</p>
                  <p className="text-xs text-ink-soft">{order.customer_email}</p>
                </td>
                <td className="px-3 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-3 py-3">
                  <PaymentStatusBadge status={order.payment_status} />
                </td>
                <td className="px-3 py-3 font-semibold">{formatMoney(order.grand_total)}</td>
                <td className="px-3 py-3 text-ink-soft">{formatDate(order.created_at)}</td>
                <td className="px-3 py-3 text-right">
                  <Link to={`/admin/orders/${order.id}`} className="text-sm font-semibold text-pine">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
          <CatalogPagination count={orders.data?.count ?? 0} pageSize={PAGE_SIZE} />
        </>
      ) : null}
    </AdminPage>
  )
}
