import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import { Badge } from '@/components/ui/Card'
import { formatDayLabel, formatDateTime, formatStatus } from '@/lib/format'
import type { Order } from '@/types/api'

const FULFILLMENT = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']

const MILESTONES = [
  { key: 'CONFIRMED', label: 'Order Confirmed', match: ['CONFIRMED', 'PROCESSING', 'PACKED'] },
  { key: 'SHIPPED', label: 'Shipped', match: ['SHIPPED'] },
  { key: 'OUT_FOR_DELIVERY', label: 'Out For Delivery', match: ['OUT_FOR_DELIVERY'] },
  { key: 'DELIVERED', label: 'Delivered', match: ['DELIVERED'] },
] as const

export type OrderUpdate = {
  id: string
  status: string
  title: string
  note: string
  at: string
  tone: 'done' | 'current' | 'pending' | 'warning' | 'error'
}

const TITLE_BY_STATUS: Record<string, string> = {
  ORDER_PLACED: 'Order Placed',
  PENDING: 'Order Placed',
  CONFIRMED: 'Order Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out For Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return Requested',
  RETURNED: 'Returned',
  REFUND_PENDING: 'Refund Pending',
  REFUNDED: 'Refunded',
  DELIVERY_ATTEMPTED: 'Delivery Attempted',
}

function toneForStatus(status: string, isLatest: boolean): OrderUpdate['tone'] {
  if (status === 'CANCELLED' || status === 'FAILED') return 'error'
  if (status === 'DELIVERY_ATTEMPTED' || status === 'RETURN_REQUESTED') return 'warning'
  if (isLatest) return 'current'
  return 'done'
}

export function buildOrderUpdates(order: Order): OrderUpdate[] {
  const events: OrderUpdate[] = []
  const shipmentEvents = order.shipment?.tracking_events ?? []

  if (!shipmentEvents.some((event) => event.status === 'ORDER_PLACED' || event.status === 'PENDING')) {
    events.push({
      id: `placed-${order.id}`,
      status: 'ORDER_PLACED',
      title: 'Order Placed',
      note: 'Your order has been placed successfully.',
      at: order.created_at,
      tone: 'done',
    })
  }

  for (const payment of order.payments) {
    if (payment.status === 'SUCCESS' && payment.paid_at) {
      const already = shipmentEvents.some((event) => event.status === 'CONFIRMED')
      if (!already) {
        events.push({
          id: `paid-${payment.id}`,
          status: 'CONFIRMED',
          title: 'Order Confirmed',
          note: 'Payment successful. All set. No cash needed when your order arrives.',
          at: payment.paid_at,
          tone: 'done',
        })
      }
    }
  }

  for (const [index, event] of shipmentEvents.entries()) {
    events.push({
      id: `ship-${index}-${event.at}`,
      status: event.status,
      title: TITLE_BY_STATUS[event.status] || formatStatus(event.status),
      note: event.note || formatStatus(event.status),
      at: event.at,
      tone: 'done',
    })
  }

  if (order.status === 'CANCELLED' && !events.some((event) => event.status === 'CANCELLED')) {
    events.push({
      id: `cancel-${order.id}`,
      status: 'CANCELLED',
      title: 'Cancelled',
      note: order.cancel_reason ? `Reason: ${order.cancel_reason}` : 'This order was cancelled.',
      at: order.updated_at || order.created_at,
      tone: 'error',
    })
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  if (events.length) {
    const last = events[events.length - 1]
    last.tone = toneForStatus(last.status, true)
    for (let i = 0; i < events.length - 1; i += 1) {
      if (events[i].tone === 'done') continue
      events[i].tone = toneForStatus(events[i].status, false)
    }
  }
  return events
}

function milestoneState(orderStatus: string, milestoneKey: string) {
  if (orderStatus === 'CANCELLED') return milestoneKey === 'CONFIRMED' ? 'error' : 'pending'
  if (['REFUNDED', 'RETURNED', 'RETURN_REQUESTED', 'REFUND_PENDING'].includes(orderStatus)) {
    return 'done'
  }
  const current = FULFILLMENT.indexOf(orderStatus)
  const target = FULFILLMENT.indexOf(milestoneKey)
  if (current < 0 || target < 0) return 'pending'
  if (current > target) return 'done'
  if (current === target) return 'current'
  // Packing/processing still count as past "Order Confirmed"
  if (milestoneKey === 'CONFIRMED' && current >= FULFILLMENT.indexOf('CONFIRMED')) return 'done'
  return 'pending'
}

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge>{formatStatus(status)}</Badge>
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const tone = status === 'PAID' || status === 'REFUNDED' ? 'text-good' : status === 'FAILED' ? 'text-red-700' : 'text-ink-soft'
  return (
    <span className={`text-sm font-semibold ${tone}`}>
      Payment {formatStatus(status).toLowerCase()}
    </span>
  )
}

/** Compact admin strip of all fulfilment steps. */
export function OrderTimeline({ status }: { status: string }) {
  if (!FULFILLMENT.includes(status)) {
    return (
      <p className="text-sm text-ink-soft">
        Current status: <span className="font-semibold text-ink">{formatStatus(status)}</span>
      </p>
    )
  }
  const current = FULFILLMENT.indexOf(status)
  return (
    <ol className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {FULFILLMENT.map((step, index) => {
        const done = index <= current
        return (
          <li
            key={step}
            className={`rounded-xl border px-2 py-2 text-center text-xs ${done ? 'border-pine bg-paper-2 text-pine' : 'border-line text-ink-soft'}`}
          >
            {formatStatus(step)}
          </li>
        )
      })}
    </ol>
  )
}

function Dot({ tone }: { tone: OrderUpdate['tone'] | 'done' | 'current' | 'pending' | 'error' }) {
  const color =
    tone === 'error'
      ? 'bg-red-600 ring-red-200'
      : tone === 'warning'
        ? 'bg-amber-500 ring-amber-200'
        : tone === 'pending'
          ? 'bg-line ring-paper-2'
          : 'bg-pine ring-pine/20'
  return <span className={`mt-1 size-3 shrink-0 rounded-full ring-4 ${color}`} />
}

export function OrderMilestoneTrack({ order }: { order: Order }) {
  const updates = buildOrderUpdates(order)
  const dateFor = (key: string) => {
    const hit = [...updates].reverse().find((event) => {
      if (key === 'CONFIRMED') return ['CONFIRMED', 'ORDER_PLACED', 'PROCESSING', 'PACKED'].includes(event.status)
      return event.status === key
    })
    return hit?.at
  }

  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {MILESTONES.map((milestone, index) => {
        const state = milestoneState(order.status, milestone.key)
        const at = dateFor(milestone.key)
        const done = state === 'done' || state === 'current'
        return (
          <li key={milestone.key} className="relative flex gap-3">
            {index < MILESTONES.length - 1 ? (
              <span
                className={`absolute left-1.25 top-4 hidden h-px w-[calc(100%+0.75rem)] sm:block ${done ? 'bg-pine' : 'bg-line'}`}
                aria-hidden
              />
            ) : null}
            <Dot tone={state === 'error' ? 'error' : done ? (state === 'current' ? 'current' : 'done') : 'pending'} />
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${done ? 'text-ink' : 'text-ink-soft'}`}>{milestone.label}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{at ? formatDayLabel(at) : '—'}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function OrderUpdatesList({ updates, animated = false }: { updates: OrderUpdate[]; animated?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <ol className="relative space-y-0">
      {updates.map((event, index) => {
        const isLast = index === updates.length - 1
        const lineTone =
          event.tone === 'error' ? 'bg-red-300' : event.tone === 'warning' ? 'bg-amber-300' : 'bg-pine/40'
        return (
          <motion.li
            key={event.id}
            className="relative flex gap-3 pb-6 last:pb-0"
            initial={animated && !reduce ? { opacity: 0, x: -8 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: animated && !reduce ? index * 0.05 : 0 }}
          >
            {!isLast ? <span className={`absolute left-1.25 top-3 h-full w-0.5 ${lineTone}`} aria-hidden /> : null}
            <Dot tone={event.tone} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="font-semibold text-ink">{event.title}</p>
                <p className="text-sm text-ink-soft">{formatDayLabel(event.at)}</p>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {event.note}
                <span className="mt-0.5 block text-xs">{formatDateTime(event.at)}</span>
              </p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}

export function OrderUpdatesModal({
  open,
  onClose,
  order,
}: {
  open: boolean
  onClose: () => void
  order: Order
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const updates = buildOrderUpdates(order)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-display text-xl">
            All updates
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-paper-2"
            onClick={onClose}
            aria-label="Close updates"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[calc(85vh-4.5rem)] overflow-y-auto px-5 py-5">
          {updates.length ? (
            <OrderUpdatesList updates={updates} animated />
          ) : (
            <p className="text-sm text-ink-soft">Tracking updates will appear here as the parcel moves.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function OrderTrackingCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false)
  const updates = buildOrderUpdates(order)
  const latest = updates[updates.length - 1]
  const paid = order.payment_status === 'PAID'

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className={`px-4 py-3 text-sm font-medium ${paid ? 'bg-good/15 text-good' : 'bg-paper-2 text-ink-soft'}`}>
        {paid
          ? 'Payment successful. All set. No cash needed when your order arrives.'
          : order.payment_status === 'PENDING'
            ? 'Payment pending. Complete payment or pay on delivery if you chose COD.'
            : `Payment ${formatStatus(order.payment_status).toLowerCase()}.`}
      </div>
      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Delivery updates</p>
            <p className="mt-1 font-display text-2xl leading-none">{latest?.title || formatStatus(order.status)}</p>
            {latest ? <p className="mt-2 text-sm text-ink-soft">{formatDayLabel(latest.at)}</p> : null}
          </div>
          {order.shipment?.estimated_delivery ? (
            <p className="rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-soft">
              Est. delivery <span className="font-semibold text-ink">{formatDayLabel(order.shipment.estimated_delivery)}</span>
            </p>
          ) : null}
        </div>

        <OrderMilestoneTrack order={order} />

        <div className="border-t border-line pt-4">
          <OrderUpdatesList updates={updates.slice(-3)} />
          <button type="button" className="mt-2 text-sm font-semibold text-pine hover:underline" onClick={() => setOpen(true)}>
            See all updates
          </button>
        </div>

        {order.shipment ? (
          <p className="text-xs text-ink-soft">
            {order.shipment.carrier} · Tracking {order.shipment.tracking_number}
          </p>
        ) : null}
      </div>
      <OrderUpdatesModal open={open} onClose={() => setOpen(false)} order={order} />
    </section>
  )
}

export function PaymentBanner({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-good/15 px-4 py-3 text-sm font-medium text-good">{children}</div>
}
