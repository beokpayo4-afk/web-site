import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white p-5 shadow-sm ${className}`}>{children}</div>
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-pine">
      {children}
    </span>
  )
}

export function PageHeader({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker ? <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-clay">{kicker}</p> : null}
        <h1 className="font-display text-3xl text-ink md:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  )
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' }) {
  const cls = tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
  return <div className={`rounded-xl px-4 py-3 text-sm ${cls}`}>{children}</div>
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-2 text-ink-soft">{body}</p>
    </div>
  )
}
