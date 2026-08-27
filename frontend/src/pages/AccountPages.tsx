import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'

import { AddressForm } from '@/components/checkout/AddressForm'
import { Button } from '@/components/ui/Button'
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/api'
import { formatDate, formatMoney, formatStatus } from '@/lib/format'
import { authService } from '@/services/auth'
import { catalogService } from '@/services/catalog'
import { commerceService } from '@/services/commerce'
import { engagementService } from '@/services/engagement'

export function AccountLayout() {
  const links = [
    ['/account/orders', 'Orders'],
    ['/account/wishlist', 'Wishlist'],
    ['/account/reviews', 'Reviews'],
    ['/account/addresses', 'Addresses'],
    ['/account/notifications', 'Notifications'],
    ['/account/settings', 'Settings'],
  ]
  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr]">
      <nav className="grid h-fit gap-2 rounded-2xl bg-white p-4 text-sm">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'font-semibold text-pine' : 'text-ink-soft')}>
            {label}
          </NavLink>
        ))}
      </nav>
      <div>
        <Outlet />
      </div>
    </div>
  )
}

function ChangePasswordForm() {
  const { profile } = useAuth()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const schema = z
    .object({
      current_password: z.string().min(8),
      new_password: z.string().min(8),
      confirm_password: z.string().min(8),
    })
    .refine((values) => values.new_password === values.confirm_password, {
      message: 'Passwords do not match.',
      path: ['confirm_password'],
    })
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          setError('')
          setSaved(false)
          await authService.changePassword({
            current_password: values.current_password,
            new_password: values.new_password,
          })
          form.reset()
          setSaved(true)
        } catch (err) {
          setError(getErrorMessage(err))
        }
      })}
    >
      <h2 className="font-semibold">Change password</h2>
      {error ? <Alert>{error}</Alert> : null}
      {saved ? <Alert tone="success">Password updated.</Alert> : null}
      <input type="email" name="username" autoComplete="username" value={profile?.email ?? ''} readOnly className="sr-only" tabIndex={-1} />
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        {...form.register('current_password')}
        error={form.formState.errors.current_password?.message}
      />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        {...form.register('new_password')}
        error={form.formState.errors.new_password?.message}
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        {...form.register('confirm_password')}
        error={form.formState.errors.confirm_password?.message}
      />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Update password
      </Button>
    </form>
  )
}

export function WishlistPage() {
  const queryClient = useQueryClient()
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: commerceService.wishlist })
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  return (
    <div>
      <PageHeader kicker="Saved" title="Wishlist" />
      {error ? <Alert>{error}</Alert> : null}
      {wishlist.isError ? <Alert>Wishlist could not load.</Alert> : null}
      {wishlist.isSuccess && wishlist.data.length === 0 ? (
        <EmptyState title="Nothing saved" body="Tap Save on a product to keep it here." />
      ) : null}
      <div className="space-y-3">
        {wishlist.data?.map((item) => (
          <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-center">
            <Link to={`/product/${item.product.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
              {item.product.primary_image ? (
                <img src={item.product.primary_image} alt="" className="size-16 rounded-xl object-cover" />
              ) : null}
              <span className="min-w-0">
                <span className="block font-medium">{item.product.name}</span>
                <span className="block text-sm text-ink-soft">{formatMoney(item.product.selling_price)}</span>
                <span className="block text-xs text-ink-soft">
                  {item.product.stock_quantity > 0 ? 'In stock' : 'Out of stock'}
                </span>
              </span>
            </Link>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busyId === item.id || item.product.stock_quantity < 1}
                onClick={async () => {
                  try {
                    setError('')
                    setBusyId(item.id)
                    await commerceService.moveWishlistToCart(item.id)
                    await queryClient.invalidateQueries({ queryKey: ['wishlist'] })
                    await queryClient.invalidateQueries({ queryKey: ['cart'] })
                  } catch (err) {
                    setError(getErrorMessage(err, 'Could not move that item to your cart.'))
                  } finally {
                    setBusyId(null)
                  }
                }}
              >
                {busyId === item.id ? 'Moving…' : 'Move to cart'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busyId === item.id}
                onClick={async () => {
                  try {
                    setError('')
                    setBusyId(item.id)
                    await commerceService.removeWishlist(item.id)
                    await queryClient.invalidateQueries({ queryKey: ['wishlist'] })
                  } catch (err) {
                    setError(getErrorMessage(err, 'Could not remove that item.'))
                  } finally {
                    setBusyId(null)
                  }
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MyReviewsPage() {
  const reviews = useQuery({ queryKey: ['my-reviews'], queryFn: catalogService.myReviews })
  return (
    <div>
      <PageHeader kicker="Account" title="Your reviews" />
      {reviews.isError ? <Alert>Reviews could not load.</Alert> : null}
      {reviews.isSuccess && reviews.data.results.length === 0 ? (
        <EmptyState title="No reviews yet" body="After a delivered order you can review the products you bought." />
      ) : null}
      <div className="space-y-3">
        {reviews.data?.results.map((review) => (
          <Card key={review.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                {review.product_slug ? (
                  <Link to={`/product/${review.product_slug}`} className="font-semibold hover:text-pine">
                    {review.product_name ?? 'Product'}
                  </Link>
                ) : (
                  <p className="font-semibold">{review.product_name ?? 'Product'}</p>
                )}
                <p className="text-sm text-ink-soft">
                  {review.rating}/5 · {formatDate(review.created_at)}
                </p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{formatStatus(review.status)}</span>
            </div>
            <p className="mt-2 font-medium">{review.title}</p>
            <p className="mt-1 text-sm">{review.body}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-soft">
              {review.is_verified_purchase ? <span>Verified purchase</span> : null}
              {review.status === 'REJECTED' && review.moderation_note ? <span>{review.moderation_note}</span> : null}
              {review.status === 'PENDING' ? <span>Waiting for moderation.</span> : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function AddressesPage() {
  const queryClient = useQueryClient()
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: authService.addresses })
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['addresses'] })
  }

  return (
    <div>
      <PageHeader kicker="Account" title="Addresses" />
      {error ? <Alert>{error}</Alert> : null}
      {addresses.isError ? <Alert>Could not load addresses.</Alert> : null}
      {addresses.isSuccess && addresses.data.length === 0 ? (
        <EmptyState title="No addresses yet" body="Add a delivery address to use at checkout." />
      ) : null}
      <div className="mb-8 grid gap-3">
        {addresses.data?.map((address) => (
          <Card key={address.id}>
            {editingId === address.id ? (
              <AddressForm
                initial={address}
                submitLabel="Update address"
                onCancel={() => setEditingId(null)}
                onSubmit={async (payload) => {
                  try {
                    setError('')
                    await authService.updateAddress(address.id, payload)
                    setEditingId(null)
                    await refresh()
                  } catch (err) {
                    setError(getErrorMessage(err, 'Could not update that address.'))
                    throw err
                  }
                }}
              />
            ) : (
              <>
                <p className="font-semibold">
                  {address.full_name}
                  {address.is_default ? <span className="ml-2 text-xs font-medium uppercase tracking-wide text-clay">Default</span> : null}
                </p>
                <p className="text-sm text-ink-soft">
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.postal_code}
                </p>
                <p className="text-sm text-ink-soft">{address.phone}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <button type="button" className="font-semibold text-pine" onClick={() => setEditingId(address.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="font-semibold text-red-700"
                    onClick={async () => {
                      try {
                        setError('')
                        await authService.deleteAddress(address.id)
                        await refresh()
                      } catch (err) {
                        setError(getErrorMessage(err, 'Could not delete that address.'))
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
      <div className="max-w-xl rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-semibold">Add address</h2>
        <AddressForm
          submitLabel="Save address"
          onSubmit={async (payload) => {
            try {
              setError('')
              await authService.createAddress(payload)
              await refresh()
            } catch (err) {
              setError(getErrorMessage(err, 'Could not save that address.'))
              throw err
            }
          }}
        />
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const notes = useQuery({ queryKey: ['notifications'], queryFn: engagementService.notifications })
  return (
    <div>
      <PageHeader kicker="Inbox" title="Notifications" />
      <div className="space-y-3">
        {notes.data?.results.map((item) => (
          <button
            type="button"
            key={item.id}
            className="block w-full rounded-2xl border border-line bg-white p-4 text-left"
            onClick={async () => {
              await engagementService.markRead(item.id)
              await queryClient.invalidateQueries({ queryKey: ['notifications'] })
            }}
          >
            <p className="font-semibold">{item.title}</p>
            <p className="text-sm text-ink-soft">{item.message}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { profile, logout } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  if (!profile) return null

  return (
    <div className="space-y-8">
      <PageHeader kicker="Account" title="Settings" />

      <Card className="max-w-lg space-y-4">
        <h2 className="font-display text-xl">Your profile</h2>
        {error ? <Alert>{error}</Alert> : null}
        {saved ? <Alert tone="success">Saved.</Alert> : null}
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            try {
              setError('')
              setSaved(false)
              await authService.updateMe({
                full_name: String(form.get('full_name')),
                phone: String(form.get('phone')),
              })
              await queryClient.invalidateQueries({ queryKey: ['me'] })
              setSaved(true)
            } catch (err) {
              setError(getErrorMessage(err))
            }
          }}
        >
          <Input name="full_name" label="Full name" defaultValue={profile.full_name} />
          <Input name="phone" label="Phone" defaultValue={profile.phone} />
          <Input name="email" label="Email" defaultValue={profile.email} disabled />
          <p className="text-sm text-ink-soft">Role: {profile.role.replaceAll('_', ' ').toLowerCase()}</p>
          <Button type="submit">Save</Button>
        </form>
      </Card>

      <Card className="max-w-lg">
        <ChangePasswordForm />
      </Card>

      <Card className="max-w-lg space-y-3">
        <h2 className="font-display text-xl">Session</h2>
        <p className="text-sm text-ink-soft">Sign out on this device. Your cart and wishlist stay saved to your account.</p>
        <Button type="button" variant="ghost" onClick={() => void logout()}>
          Sign out
        </Button>
      </Card>
    </div>
  )
}
