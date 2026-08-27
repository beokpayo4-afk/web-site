export function HomeBrief() {
  const items = [
    { kicker: '01', title: 'Fewer SKUs', body: 'We keep a short list so stock, GST, and delivery stay honest.' },
    { kicker: '02', title: 'Indian-home scale', body: 'Compact appliances and desk kit that earn the counter they sit on.' },
    { kicker: '03', title: 'Price you can read', body: 'MRP beside selling price. No surprise totals at the last step.' },
  ]

  return (
    <section className="rounded-4xl border border-line bg-paper-2 px-5 py-10 md:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-clay">The brief</p>
      <h2 className="mt-2 font-display text-3xl md:text-4xl">How the shop is merchandised.</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {items.map((item) => (
          <article key={item.kicker}>
            <p className="text-sm font-semibold text-pine">{item.kicker}</p>
            <h3 className="mt-2 font-display text-2xl">{item.title}</h3>
            <p className="mt-2 text-sm text-ink-soft">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
