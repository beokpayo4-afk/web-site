import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { INDIAN_STATES } from '@/lib/india'
import type { Address } from '@/types/api'

export type AddressPayload = {
  label?: string
  full_name: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  postal_code: string
  country: string
  is_default?: boolean
}

export function AddressForm({
  initial,
  submitLabel = 'Save address',
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Address>
  submitLabel?: string
  onSubmit: (payload: AddressPayload) => Promise<void>
  onCancel?: () => void
}) {
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    try {
      await onSubmit({
        label: String(form.get('label') ?? ''),
        full_name: String(form.get('full_name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        line1: String(form.get('line1') ?? ''),
        line2: String(form.get('line2') ?? ''),
        city: String(form.get('city') ?? ''),
        state: String(form.get('state') ?? ''),
        postal_code: String(form.get('postal_code') ?? ''),
        country: 'India',
        is_default: form.get('is_default') === 'on',
      })
      event.currentTarget.reset()
    } catch {
      /* Parent surfaces the error. */
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <Input name="label" label="Label" defaultValue={initial?.label ?? ''} placeholder="Home, studio…" />
      <Input name="full_name" label="Full name" defaultValue={initial?.full_name ?? ''} autoComplete="name" required />
      <Input
        name="phone"
        label="Mobile"
        defaultValue={initial?.phone ?? ''}
        inputMode="numeric"
        pattern="[6-9][0-9]{9}"
        title="10-digit Indian mobile number"
        autoComplete="tel"
        required
      />
      <Input name="line1" label="Address line 1" defaultValue={initial?.line1 ?? ''} autoComplete="address-line1" required />
      <Input name="line2" label="Address line 2" defaultValue={initial?.line2 ?? ''} autoComplete="address-line2" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="city" label="City" defaultValue={initial?.city ?? ''} autoComplete="address-level2" required />
        <label className="block text-left" htmlFor="address-state">
          <span className="mb-1.5 block text-sm font-medium text-ink">State</span>
          <select
            id="address-state"
            name="state"
            defaultValue={initial?.state ?? ''}
            required
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-pine"
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Input
        name="postal_code"
        label="PIN code"
        defaultValue={initial?.postal_code ?? ''}
        inputMode="numeric"
        pattern="[0-9]{6}"
        title="6-digit PIN code"
        autoComplete="postal-code"
        required
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_default" defaultChecked={initial?.is_default ?? false} />
        Default address
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
