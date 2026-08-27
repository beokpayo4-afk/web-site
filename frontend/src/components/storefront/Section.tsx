import { Link } from 'react-router-dom'

export function SectionHeader({
  kicker,
  title,
  subtitle,
  to,
  action = 'Shop',
}: {
  kicker?: string
  title: string
  subtitle?: string
  to?: string
  action?: string
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-clay">{kicker}</p> : null}
        <h2 className="font-display text-2xl text-ink md:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 max-w-xl text-sm text-ink-soft">{subtitle}</p> : null}
      </div>
      {to ? (
        <Link to={to} className={`${action === 'Shop' ? 'rounded-md bg-clay px-5 py-2 text-sm font-semibold text-white hover:bg-clay-2' : 'text-sm font-semibold text-pine hover:underline'}`}>
          {action}
        </Link>
      ) : null}
    </div>
  )
}

export function QueryError({
  title = 'Could not load this section',
  body = 'Check your connection and try again.',
  onRetry,
}: {
  title?: string
  body?: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center" role="alert">
      <p className="font-semibold text-red-900">{title}</p>
      <p className="mt-1 text-sm text-red-800">{body}</p>
      {onRetry ? (
        <button type="button" className="mt-4 text-sm font-semibold text-pine underline" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}
