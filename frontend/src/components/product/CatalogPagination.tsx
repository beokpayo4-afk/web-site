import { useSearchParams } from 'react-router-dom'

export function CatalogPagination({
  count,
  pageSize = 12,
}: {
  count: number
  pageSize?: number
}) {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? 1)
  const size = Number(params.get('page_size') ?? pageSize)
  const totalPages = Math.max(1, Math.ceil(count / size))
  if (totalPages <= 1) return null

  function go(next: number) {
    const copy = new URLSearchParams(params)
    copy.set('page', String(next))
    setParams(copy)
  }

  const from = (page - 1) * size + 1
  const to = Math.min(page * size, count)

  return (
    <nav className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm sm:flex-row" aria-label="Catalogue pagination">
      <p className="text-ink-soft">
        Showing {from}–{to} of {count}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-line px-3 py-1 disabled:opacity-40"
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => go(page - 1)}
        >
          Previous
        </button>
        <span aria-live="polite">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          className="rounded-full border border-line px-3 py-1 disabled:opacity-40"
          disabled={page >= totalPages}
          aria-label="Next page"
          onClick={() => go(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}
