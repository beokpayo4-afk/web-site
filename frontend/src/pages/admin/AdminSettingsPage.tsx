import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { AdminPage } from '@/components/admin/AdminPage'
import { Button } from '@/components/ui/Button'
import { Alert, Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/api'
import { authService } from '@/services/auth'

export function AdminSettingsPage() {
  const { profile, logout } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  if (!profile) return null

  return (
    <AdminPage title="Settings">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-4">
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

        <Card className="space-y-3">
          <h2 className="font-display text-xl">Session</h2>
          <p className="text-sm text-ink-soft">Sign out of the admin workspace on this device.</p>
          <Button type="button" variant="ghost" onClick={() => void logout()}>
            Logout
          </Button>
        </Card>
      </div>
    </AdminPage>
  )
}
