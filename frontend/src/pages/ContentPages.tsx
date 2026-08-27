import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Alert, PageHeader } from '@/components/ui/Card'
import { Input, TextArea } from '@/components/ui/Input'
import { getErrorMessage } from '@/lib/api'
import { engagementService } from '@/services/engagement'

export function AboutPage() {
  return (
    <article className="space-y-10">
      <div className="max-w-3xl">
        <PageHeader kicker="Studio" title="About Nexora" />
        <p className="text-lg text-ink-soft">
          Nexora is an independent storefront for everyday electronics and compact home appliances. The catalogue, copy,
          and visual system are original. We do not resell another brand’s product pages or photography.
        </p>
        <p className="mt-4 text-ink-soft">
          The aim is a quieter marketplace: honest MRP versus selling price, GST calculated on the server, inventory that
          cannot be oversold from the browser, and order tracking that is not theatre.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: 'Chosen, not scraped', body: 'Every SKU is written for this shop. Placeholder art stands in until we shoot our own.' },
          { title: 'Prices you can audit', body: 'Selling price never exceeds MRP. Tax classes live on the product, not in a frontend guess.' },
          { title: 'Small-home kit', body: 'Audio, charging, storage, and appliances that earn the centimetres they occupy.' },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-line bg-white p-5">
            <p className="font-semibold">{item.title}</p>
            <p className="mt-2 text-sm text-ink-soft">{item.body}</p>
          </div>
        ))}
      </div>
      <Link to="/shop">
        <Button>Browse the catalogue</Button>
      </Link>
    </article>
  )
}

export function ContactPage() {
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
      <div>
        <PageHeader kicker="Help" title="Contact" />
        {error ? <Alert>{error}</Alert> : null}
        {done ? <Alert tone="success">Message received. We will reply by email.</Alert> : null}
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            try {
              setError('')
              setPending(true)
              await engagementService.contact({
                name: String(form.get('name')),
                email: String(form.get('email')),
                subject: String(form.get('subject')),
                message: String(form.get('message')),
              })
              setDone(true)
              event.currentTarget.reset()
            } catch (err) {
              setError(getErrorMessage(err, 'Could not send that message.'))
            } finally {
              setPending(false)
            }
          }}
        >
          <Input name="name" label="Name" autoComplete="name" required />
          <Input name="email" label="Email" type="email" autoComplete="email" required />
          <Input name="subject" label="Subject" required />
          <TextArea name="message" label="Message" required />
          <Button type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Send'}
          </Button>
        </form>
      </div>
      <aside className="rounded-2xl border border-line bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Studio</p>
        <p className="mt-2 font-display text-2xl">Nexora desk</p>
        <p className="mt-3 text-sm text-ink-soft">Bengaluru, India — replies on business days. This is placeholder contact copy until final branding.</p>
        <p className="mt-4 text-sm">
          <a className="font-semibold text-pine hover:underline" href="mailto:hello@nexora.example">
            hello@nexora.example
          </a>
        </p>
        <p className="mt-6 text-sm text-ink-soft">
          For orders already placed, use the{' '}
          <Link to="/account/orders" className="font-semibold text-pine hover:underline">
            account orders
          </Link>{' '}
          page after you sign in.
        </p>
      </aside>
    </div>
  )
}

export function FaqPage() {
  const items = [
    ['Where do you ship?', 'We ship across India. Shipping is free. GST is calculated at checkout from the destination state.'],
    ['How is GST applied?', 'Each product has its own tax class. Intra-state orders use CGST+SGST; other states use IGST. Totals are never taken from the browser.'],
    ['Can I return a product?', 'Unused items can be returned within 7 days of delivery if they are in original condition.'],
    ['How do payments work in this demo?', 'Checkout opens a mock payment. The backend verifies a signed webhook and the order total. The browser cannot mark an order as paid.'],
  ]
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader kicker="Help" title="FAQ" />
      {items.map(([q, a]) => (
        <details key={q} className="rounded-2xl border border-line bg-white p-4">
          <summary className="cursor-pointer font-semibold">{q}</summary>
          <p className="mt-2 text-sm text-ink-soft">{a}</p>
        </details>
      ))}
    </div>
  )
}

export function PolicyPage({ title, body }: { title: string; body: string }) {
  return (
    <article className="max-w-3xl">
      <PageHeader kicker="Legal" title={title} />
      <p className="whitespace-pre-line text-ink-soft">{body}</p>
    </article>
  )
}
