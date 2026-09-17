import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AddressForm, type AddressPayload } from '@/components/checkout/AddressForm'
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary'
import { Button } from '@/components/ui/Button'
import { Alert, EmptyState, PageHeader } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { getErrorMessage } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { authService } from '@/services/auth'
import { commerceService } from '@/services/commerce'
import type { Address } from '@/types/api'

const PAYMENT_METHODS = [
  {
    id: 'upi',
    label: 'UPI',
    description: 'Pay with GPay, PhonePe, Paytm, or any UPI app.',
  },
  {
    id: 'card',
    label: 'Credit / Debit card',
    description: 'Visa, Mastercard, RuPay, and American Express.',
  },
  {
    id: 'netbanking',
    label: 'Net banking',
    description: 'Pay directly from your bank account.',
  },
  {
    id: 'wallet',
    label: 'Wallets',
    description: 'Paytm, Amazon Pay, and other wallets.',
  },
  {
    id: 'cod',
    label: 'Cash on delivery',
    description: 'Pay in cash when the order arrives.',
  },
] as const

type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id']

export function CheckoutPage() {
  const { isAuthenticated } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const addressesQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: authService.addresses,
    enabled: isAuthenticated,
  })
  const addresses = addressesQuery.data ?? []
  const defaultId = addresses.find((row) => row.is_default)?.id ?? addresses[0]?.id
  const [addressId, setAddressId] = useState<number | undefined>(undefined)
  const selectedId = addressId ?? defaultId
  const selected = addresses.find((row) => row.id === selectedId)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('upi')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const previewKey = useMemo(
    () => ['checkout-preview', selectedId, cart.data?.updated_at, selected?.state],
    [selectedId, cart.data?.updated_at, selected?.state],
  )
  const preview = useQuery({
    queryKey: previewKey,
    queryFn: () =>
      commerceService.preview({
        shipping_address_id: selectedId!,
        shipping_state: addresses.find((row) => row.id === selectedId)?.state,
      }),
    enabled: Boolean(selectedId) && (cart.data?.items.length ?? 0) > 0,
    retry: false,
  })

  async function saveAddress(payload: AddressPayload, id?: number) {
    try {
      setError('')
      if (id) await authService.updateAddress(id, payload)
      else {
        const created = await authService.createAddress(payload)
        setAddressId(created.id)
      }
      await queryClient.invalidateQueries({ queryKey: ['addresses'] })
      setAdding(false)
      setEditingId(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save that address.'))
      throw err
    }
  }

  if (!isAuthenticated) {
    return <EmptyState title="Sign in to checkout" body="We need an account to place and track the order." />
  }
  if (cart.isLoading || addressesQuery.isLoading) {
    return <p className="text-sm text-ink-soft">Loading checkout…</p>
  }
  if ((cart.data?.items.length ?? 0) === 0) {
    return <EmptyState title="Nothing to check out" body="Add items to your cart first." />
  }

  const selectedPayment = PAYMENT_METHODS.find((method) => method.id === paymentMethod)!
  const payLabel =
    paymentMethod === 'cod'
      ? pending
        ? 'Placing order…'
        : 'Place COD order'
      : pending
        ? 'Paying…'
        : `Pay with ${selectedPayment.label}`

  return (
    <div>
      <PageHeader kicker="Checkout" title="Place your order" />
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Delivery address</h2>
              <button type="button" className="text-sm font-semibold text-pine" onClick={() => setAdding((value) => !value)}>
                {adding ? 'Close' : 'Add address'}
              </button>
            </div>
            {addressesQuery.isError ? (
              <Alert>Addresses could not load. Refresh and try again.</Alert>
            ) : null}
            {addresses.length === 0 && !adding ? (
              <p className="text-sm text-ink-soft">Add an address to calculate GST and shipping.</p>
            ) : null}
            <div className="space-y-3">
              {addresses.map((address) => (
                <AddressChoice
                  key={address.id}
                  address={address}
                  selected={selectedId === address.id}
                  editing={editingId === address.id}
                  onSelect={() => setAddressId(address.id)}
                  onEdit={() => setEditingId(address.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(payload) => saveAddress(payload, address.id)}
                  onDelete={async () => {
                    try {
                      setError('')
                      await authService.deleteAddress(address.id)
                      if (selectedId === address.id) setAddressId(undefined)
                      await queryClient.invalidateQueries({ queryKey: ['addresses'] })
                    } catch (err) {
                      setError(getErrorMessage(err, 'Could not delete that address.'))
                    }
                  }}
                />
              ))}
            </div>
            {adding ? (
              <div className="mt-4 rounded-2xl border border-line bg-white p-4">
                <h3 className="mb-3 font-semibold">New address</h3>
                <AddressForm
                  submitLabel="Add address"
                  onCancel={() => setAdding(false)}
                  onSubmit={(payload) => saveAddress({ ...payload, is_default: payload.is_default || addresses.length === 0 })}
                />
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-line bg-white p-4">
            <h2 className="font-semibold">Payment method</h2>
            <p className="mt-1 text-xs text-ink-soft">Choose how you want to pay for this order.</p>
            <div className="mt-4 space-y-2">
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 transition ${
                    paymentMethod === method.id ? 'border-pine bg-paper-2' : 'border-line bg-white hover:border-pine/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    className="mt-1"
                    checked={paymentMethod === method.id}
                    onChange={() => setPaymentMethod(method.id)}
                  />
                  <span>
                    <span className="block text-sm font-semibold">{method.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{method.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-line bg-white p-5 lg:sticky lg:top-28">
          <h2 className="font-semibold">Order summary</h2>
          <p className="mt-1 text-xs text-ink-soft">GST and shipping are calculated on the server from your cart. This page cannot set the total.</p>
          <div className="mt-4 space-y-2 text-sm">
            {cart.data?.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3">
                <span>
                  {item.product.name} × {item.quantity}
                </span>
                <span className="text-ink-soft">{formatMoney(Number(item.product.selling_price) * item.quantity)}</span>
              </div>
            ))}
          </div>
          {preview.isLoading ? <p className="mt-4 text-sm text-ink-soft">Calculating totals…</p> : null}
          {preview.isError ? (
            <div className="mt-4">
              <Alert>{getErrorMessage(preview.error, 'Could not calculate this order.')}</Alert>
            </div>
          ) : null}
          {preview.data ? (
            <div className="mt-4">
              <CheckoutSummary quote={preview.data} />
            </div>
          ) : null}
          {!selected ? <p className="mt-3 text-sm text-ink-soft">Select an address to calculate tax and shipping.</p> : null}
          {error ? (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          ) : null}
          <Button
            className="mt-5 w-full"
            disabled={!selected || !preview.data || preview.isError || pending}
            onClick={async () => {
              if (!selected || !preview.data) return
              try {
                setError('')
                setPending(true)
                const order = await commerceService.checkout({
                  shipping_address_id: selected.id,
                  customer_notes: `Payment method: ${selectedPayment.label}`,
                })
                if (paymentMethod === 'cod') {
                  await queryClient.invalidateQueries({ queryKey: ['cart'] })
                  await queryClient.invalidateQueries({ queryKey: ['orders'] })
                  navigate(`/order-success/${order.id}`)
                  return
                }
                const paid = await commerceService.completeMockPayment({
                  provider_payment_id: order.payment!.provider_payment_id,
                  outcome: 'success',
                })
                await queryClient.invalidateQueries({ queryKey: ['cart'] })
                await queryClient.invalidateQueries({ queryKey: ['orders'] })
                navigate(`/order-success/${paid.id}`)
              } catch (err) {
                setError(getErrorMessage(err, 'Checkout failed. Nothing was charged.'))
                await queryClient.invalidateQueries({ queryKey: ['cart'] })
              } finally {
                setPending(false)
              }
            }}
          >
            {payLabel}
          </Button>
          <p className="mt-2 text-xs text-ink-soft">
            {paymentMethod === 'cod'
              ? 'Cash on delivery leaves the order unpaid until you settle with the delivery agent.'
              : 'Online methods use the mock gateway locally. The browser cannot mark a payment as paid by itself.'}
          </p>
          <Link to="/cart" className="mt-3 inline-block text-sm font-semibold text-pine">
            Return to cart
          </Link>
        </aside>
      </div>
    </div>
  )
}

function AddressChoice({
  address,
  selected,
  editing,
  onSelect,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  address: Address
  selected: boolean
  editing: boolean
  onSelect: () => void
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (payload: AddressPayload) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  if (editing) {
    return (
      <div className="rounded-2xl border border-pine bg-white p-4">
        <AddressForm initial={address} submitLabel="Update address" onCancel={onCancelEdit} onSubmit={onSave} />
      </div>
    )
  }
  return (
    <div className={`rounded-2xl border bg-white p-4 ${selected ? 'border-pine' : 'border-line'}`}>
      <label className="flex gap-3">
        <input type="radio" name="checkout-address" checked={selected} onChange={onSelect} />
        <span>
          <span className="block font-semibold">
            {address.full_name}
            {address.is_default ? <span className="ml-2 text-xs font-medium uppercase tracking-wide text-clay">Default</span> : null}
          </span>
          <span className="block text-sm text-ink-soft">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.postal_code}
          </span>
          <span className="block text-sm text-ink-soft">{address.phone}</span>
        </span>
      </label>
      <div className="mt-3 flex gap-4 text-sm">
        <button type="button" className="font-semibold text-pine" onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className="font-semibold text-red-700"
          disabled={deleting}
          onClick={async () => {
            setDeleting(true)
            try {
              await onDelete()
            } finally {
              setDeleting(false)
            }
          }}
        >
          {deleting ? 'Removing…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
