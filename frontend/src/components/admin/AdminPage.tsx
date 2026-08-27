import type { ReactNode } from 'react'

import { getErrorMessage } from '@/lib/api'

export function AdminPage({
  title,
  actions,
  error,
  children,
}: {
  title: string
  actions?: ReactNode
  error?: unknown
  children: ReactNode
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink md:text-4xl">{title}</h1>
        </div>
        {actions}
      </div>
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800" role="alert">
          {getErrorMessage(error, 'Something went wrong.')}
        </div>
      ) : null}
      {children}
    </div>
  )
}
