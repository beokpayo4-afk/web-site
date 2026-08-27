import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { getErrorMessage } from '@/lib/api'
import { engagementService } from '@/services/engagement'

export function NewsletterSection({ compact = false, tone = 'light' }: { compact?: boolean; tone?: 'light' | 'dark' }) {
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    try {
      setPending(true)
      setError('')
      await engagementService.contact({
        name: 'Newsletter',
        email,
        subject: 'Newsletter signup',
        message: 'Please add this address to Nexora shop notes. No product dumps.',
      })
      setDone(true)
      event.currentTarget.reset()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save that address.'))
    } finally {
      setPending(false)
    }
  }

  const dark = tone === 'dark'

  return (
    <section
      className={
        compact
          ? ''
          : dark
            ? ''
            : 'rounded-4xl border border-line bg-paper-2 px-5 py-10 md:px-10'
      }
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${dark ? 'text-paper/70' : 'text-clay'}`}>Notes</p>
      <h2 className={`mt-2 font-display text-2xl md:text-3xl ${dark ? 'text-paper' : ''}`}>
        A short letter when something useful lands.
      </h2>
      <p className={`mt-2 max-w-xl text-sm ${dark ? 'text-paper/75' : 'text-ink-soft'}`}>
        No copied catalogues. Occasional restocks, shipping notes, and one honest recommendation.
      </p>
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {done ? (
        <div className="mt-4">
          <Alert tone="success">Thanks — if the address is valid, you are on the list.</Alert>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input name="email" label="Email" type="email" autoComplete="email" required />
          </div>
          <Button type="submit" disabled={pending} className="sm:mb-0.5">
            {pending ? 'Saving…' : 'Subscribe'}
          </Button>
        </form>
      )}
    </section>
  )
}
