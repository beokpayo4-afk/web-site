import { Badge } from '@/components/ui/Card'
import { formatStatus } from '@/lib/format'

const FULFILLMENT = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']

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
          <li key={step} className={`rounded-xl border px-2 py-2 text-center text-xs ${done ? 'border-pine bg-paper-2 text-pine' : 'border-line text-ink-soft'}`}>
            {formatStatus(step)}
          </li>
        )
      })}
    </ol>
  )
}
