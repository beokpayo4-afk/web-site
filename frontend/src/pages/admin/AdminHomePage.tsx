import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { AdminPage } from '@/components/admin/AdminPage'
import { Button } from '@/components/ui/Button'
import { formatDate, formatMoney, formatStatus } from '@/lib/format'
import { adminService } from '@/services/admin'

function StatCard({
  title,
  value,
  hint,
  accent,
  icon,
}: {
  title: string
  value: string | number
  hint: string
  accent: string
  icon: string
}) {
  return (
    <article className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
          <p className="mt-1 text-sm text-ink-soft">{hint}</p>
        </div>
        <span className="flex size-11 items-center justify-center rounded-xl bg-paper-2 text-lg">{icon}</span>
      </div>
    </article>
  )
}

function MiniBars({ points }: { points: { day: string; orders: number; revenue: string }[] }) {
  const max = Math.max(1, ...points.map((point) => point.orders))
  return (
    <div className="flex h-44 items-end gap-1.5">
      {points.map((point) => (
        <div key={point.day} className="flex flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t-md bg-pine/80"
            style={{ height: `${Math.max(8, (point.orders / max) * 100)}%` }}
            title={`${point.day}: ${point.orders} orders · ${formatMoney(point.revenue)}`}
          />
        </div>
      ))}
    </div>
  )
}

export function AdminHomePage() {
  const summary = useQuery({ queryKey: ['admin-summary'], queryFn: adminService.summary })
  const data = summary.data
  const now = new Date()

  return (
    <AdminPage
      title="Dashboard"
      error={summary.error}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/products/new">
            <Button>+ Add Product</Button>
          </Link>
          <Link to="/admin/products">
            <Button variant="ghost">View Products</Button>
          </Link>
          <Link to="/admin/orders">
            <Button variant="ghost">View Orders</Button>
          </Link>
          <Button type="button" variant="ghost" onClick={() => void summary.refetch()}>
            Refresh
          </Button>
        </div>
      }
    >
      <p className="-mt-2 mb-5 text-sm text-ink-soft">
        {now.toLocaleString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}{' '}
        · Asia/Kolkata
      </p>

      {summary.isLoading ? <p className="text-sm text-ink-soft">Loading dashboard…</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Products" value={data.products} hint="Published catalogue items" accent="border-l-4 border-l-pine" icon="▣" />
            <StatCard title="Orders" value={data.orders} hint={`${data.pending_orders} pending`} accent="border-l-4 border-l-clay" icon="☰" />
            <StatCard title="Customers" value={data.customers} hint="Registered shoppers" accent="border-l-4 border-l-emerald-600" icon="☺" />
            <StatCard title="Revenue" value={formatMoney(data.revenue)} hint={`Today ${formatMoney(data.today_revenue)}`} accent="border-l-4 border-l-amber-600" icon="₹" />
            <StatCard title="Paid Orders" value={data.paid_orders} hint="Payment confirmed" accent="border-l-4 border-l-sky-700" icon="✓" />
            <StatCard title="Delivered" value={data.delivered_orders} hint="Fulfilled orders" accent="border-l-4 border-l-teal-700" icon="↗" />
            <StatCard title="Low Stock" value={data.low_stock} hint="Below threshold" accent="border-l-4 border-l-orange-600" icon="!" />
            <StatCard title="Pending Reviews" value={data.pending_reviews} hint="Awaiting moderation" accent="border-l-4 border-l-rose-600" icon="★" />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl">Sales overview</h2>
                  <p className="text-sm text-ink-soft">Orders across the last 14 days</p>
                </div>
              </div>
              <MiniBars points={data.sales_overview} />
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h2 className="font-display text-xl">Order mix</h2>
              <p className="mt-1 text-sm text-ink-soft">Current fulfilment snapshot</p>
              <ul className="mt-5 space-y-3 text-sm">
                <li className="flex justify-between rounded-xl bg-paper-2 px-3 py-2">
                  <span>Pending</span>
                  <strong>{data.pending_orders}</strong>
                </li>
                <li className="flex justify-between rounded-xl bg-paper-2 px-3 py-2">
                  <span>Paid</span>
                  <strong>{data.paid_orders}</strong>
                </li>
                <li className="flex justify-between rounded-xl bg-paper-2 px-3 py-2">
                  <span>Delivered</span>
                  <strong>{data.delivered_orders}</strong>
                </li>
                <li className="flex justify-between rounded-xl bg-paper-2 px-3 py-2">
                  <span>Open tickets</span>
                  <strong>{data.open_tickets}</strong>
                </li>
              </ul>
            </section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-xl">Recent orders</h2>
                <Link to="/admin/orders" className="text-sm font-semibold text-pine">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {data.recent_orders.length === 0 ? <p className="text-sm text-ink-soft">No orders yet.</p> : null}
                {data.recent_orders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm hover:border-pine"
                  >
                    <div>
                      <p className="font-semibold">{order.order_number}</p>
                      <p className="text-xs text-ink-soft">
                        {order.customer_email} · {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(order.grand_total)}</p>
                      <p className="text-xs text-ink-soft">{formatStatus(order.status)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-xl">Low stock</h2>
                <Link to="/admin/products?stock=low_stock" className="text-sm font-semibold text-pine">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {data.low_stock_products.length === 0 ? <p className="text-sm text-ink-soft">Stock levels look healthy.</p> : null}
                {data.low_stock_products.map((row) => (
                  <Link
                    key={row.id}
                    to={`/admin/products/${row.product_id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm hover:border-pine"
                  >
                    <div>
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-xs text-ink-soft">{row.sku}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      {row.available_quantity} left
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </AdminPage>
  )
}
