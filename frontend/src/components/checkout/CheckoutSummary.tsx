import { formatMoney, formatShipping } from '@/lib/format'
import type { Quote } from '@/types/api'

export function CheckoutSummary({ quote }: { quote: Quote }) {
  return (
    <div>
      {quote.lines?.length ? (
        <ul className="mb-4 space-y-2 border-b border-line pb-4 text-sm">
          {quote.lines.map((line) => (
            <li key={`${line.product_id}-${line.sku}`} className="flex justify-between gap-3">
              <span>
                {line.name} × {line.quantity}
              </span>
              <span>{formatMoney(line.line_total)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{formatMoney(quote.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Discount</dt>
          <dd>-{formatMoney(quote.discount_amount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>GST</dt>
          <dd>{formatMoney(quote.tax_amount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Shipping</dt>
          <dd>{formatShipping(quote.shipping_amount)}</dd>
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <dt>Total</dt>
          <dd>{formatMoney(quote.grand_total)}</dd>
        </div>
      </dl>
    </div>
  )
}
