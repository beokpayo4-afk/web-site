import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Alert, PageHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/api'
import { authService } from '@/services/auth'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

const registerSchema = loginSchema
  .extend({
    full_name: z.string().min(2, 'Enter your name.'),
    phone: z.string().optional(),
    confirm_password: z.string().min(8, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: 'Passwords do not match.',
    path: ['confirm_password'],
  })

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const [error, setError] = useState('')
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  return (
    <div className="mx-auto max-w-md">
      <PageHeader kicker="Account" title="Sign in" />
      {error ? <Alert>{error}</Alert> : null}
      <form
        className="mt-4 space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            setError('')
            await login(values.email, values.password)
            navigate(location.state?.from ?? '/', { replace: true })
          } catch (err) {
            setError(getErrorMessage(err, 'Could not sign in. Check your email and password.'))
          }
        })}
      >
        <Input label="Email" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
          error={form.formState.errors.password?.message}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/forgot-password" className="text-pine">
          Forgot password
        </Link>
        {' · '}
        <Link to="/register" className="text-pine">
          Create account
        </Link>
      </p>
    </div>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirm_password: '', full_name: '', phone: '' },
  })

  return (
    <div className="mx-auto max-w-md">
      <PageHeader kicker="Account" title="Create an account" />
      {error ? <Alert>{error}</Alert> : null}
      <form
        className="mt-4 space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            setError('')
            await register({
              email: values.email,
              password: values.password,
              full_name: values.full_name,
              phone: values.phone,
            })
            navigate('/')
          } catch (err) {
            setError(getErrorMessage(err, 'Could not create the account.'))
          }
        })}
      >
        <Input label="Full name" autoComplete="name" {...form.register('full_name')} error={form.formState.errors.full_name?.message} />
        <Input label="Email" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
        <Input label="Phone" type="tel" autoComplete="tel" {...form.register('phone')} error={form.formState.errors.phone?.message} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
          error={form.formState.errors.password?.message}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          {...form.register('confirm_password')}
          error={form.formState.errors.confirm_password?.message}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          Register
        </Button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-pine">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const form = useForm({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email address.') })), defaultValues: { email: '' } })
  return (
    <div className="mx-auto max-w-md">
      <PageHeader kicker="Account" title="Forgot password" />
      {error ? <Alert>{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      <form
        className="mt-4 space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            setError('')
            await authService.forgotPassword(values.email)
            setMessage('If an account exists, a reset email has been sent. In development it appears in the Django console.')
          } catch (err) {
            setError(getErrorMessage(err))
          }
        })}
      >
        <Input label="Email" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
    </div>
  )
}

export function ResetPasswordPage() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [params] = useSearchParams()
  const schema = z.object({
    uid: z.string().min(1, 'Reset uid is required.'),
    token: z.string().min(1, 'Reset token is required.'),
    new_password: z.string().min(8, 'Password must be at least 8 characters.'),
  })
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { uid: params.get('uid') ?? '', token: params.get('token') ?? '', new_password: '' },
  })
  return (
    <div className="mx-auto max-w-md">
      <PageHeader kicker="Account" title="Choose a new password" />
      {error ? <Alert>{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      <form
        className="mt-4 space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            setError('')
            await authService.resetPassword(values)
            setMessage('Password updated. You can sign in now.')
          } catch (err) {
            setError(getErrorMessage(err))
          }
        })}
      >
        <Input label="Reset uid" {...form.register('uid')} error={form.formState.errors.uid?.message} />
        <Input label="Token" {...form.register('token')} error={form.formState.errors.token?.message} />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          {...form.register('new_password')}
          error={form.formState.errors.new_password?.message}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </div>
  )
}
