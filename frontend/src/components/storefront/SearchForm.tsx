import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { catalogService } from '@/services/catalog'
import { formatMoney } from '@/lib/format'

export function SearchForm({
  id = 'site-search',
  className = '',
  onSubmitSuccess,
}: {
  id?: string
  className?: string
  onSubmitSuccess?: () => void
}) {
  const [params] = useSearchParams()
  const urlQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(urlQuery)
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)
  const [open, setOpen] = useState(false)
  const [debounced, setDebounced] = useState('')
  const wrapRef = useRef<HTMLFormElement>(null)
  const listId = useId()
  if (syncedQuery !== urlQuery) {
    setSyncedQuery(urlQuery)
    setQuery(urlQuery)
  }
  const navigate = useNavigate()

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query.trim()), 250)
    return () => window.clearTimeout(handle)
  }, [query])

  const suggestions = useQuery({
    queryKey: ['product-suggest', debounced],
    queryFn: () => catalogService.products({ search: debounced, page_size: 5, ordering: 'relevance' }),
    enabled: debounced.length >= 2 && open,
  })

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  function onSearch(event: FormEvent) {
    event.preventDefault()
    const value = query.trim()
    if (!value) return
    setOpen(false)
    navigate(`/search?q=${encodeURIComponent(value)}`)
    onSubmitSuccess?.()
  }

  const items = suggestions.data?.results ?? []

  return (
    <form ref={wrapRef} onSubmit={onSearch} role="search" className={`relative ${className}`} aria-label="Search the shop">
      <label className="sr-only" htmlFor={id}>
        Search products
      </label>
      <input
        id={id}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search name, SKU, brand, tag…"
        className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm"
        autoComplete="off"
        enterKeyHint="search"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && items.length > 0}
      />
      {open && debounced.length >= 2 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-white py-2 shadow-lg"
        >
          {suggestions.isFetching && !items.length ? (
            <li className="px-4 py-2 text-sm text-ink-soft">Searching…</li>
          ) : null}
          {items.map((product) => (
            <li key={product.id} role="option">
              <Link
                to={`/product/${product.slug}`}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-paper-2"
                onClick={() => {
                  setOpen(false)
                  onSubmitSuccess?.()
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{product.name}</span>
                  <span className="block text-xs text-ink-soft">{product.sku}</span>
                </span>
                <span className="shrink-0 text-ink-soft">{formatMoney(product.selling_price)}</span>
              </Link>
            </li>
          ))}
          {suggestions.isSuccess && items.length === 0 ? (
            <li className="px-4 py-2 text-sm text-ink-soft">No quick matches. Press enter to search.</li>
          ) : null}
          {query.trim() ? (
            <li>
              <button
                type="submit"
                className="w-full px-4 py-2 text-left text-sm font-semibold text-pine hover:bg-paper-2"
              >
                Search “{query.trim()}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </form>
  )
}
