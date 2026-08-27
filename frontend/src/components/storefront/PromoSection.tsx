import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'

const notes = [
  { title: 'Free shipping', body: 'Most pin codes, once the order clears stock and payment.' },
  { title: 'Returns in seven days', body: 'Unused, sealed items. The policy is written in plain language.' },
  { title: 'A person on the other end', body: 'Support answers as Nexora — not a ticket farm with a logo.' },
]

export function PromoSection() {
  return (
    <section className="relative overflow-hidden rounded-4xl bg-pine-2 px-6 py-12 text-paper md:px-12">
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-clay/40"
        aria-hidden="true"
      />
      <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-paper/65">This week</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl leading-tight md:text-5xl">
            Checkout that already did the tax.
          </h2>
          <p className="mt-4 max-w-xl text-paper/80">
            GST, discounts, and stock live on the server. A product card is a preview. The invoice is never assembled in
            the browser.
          </p>
          <div className="mt-7">
            <Link to="/shop?in_stock=true">
              <Button>Shop in-stock pieces</Button>
            </Link>
          </div>
        </div>
        <ul className="grid gap-3">
          {notes.map((note) => (
            <li key={note.title} className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="font-semibold">{note.title}</p>
              <p className="mt-1 text-sm text-paper/75">{note.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
