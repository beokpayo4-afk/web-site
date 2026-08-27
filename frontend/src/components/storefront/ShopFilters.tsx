import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { catalogService, type ProductQuery } from '@/services/catalog'

const fieldClass = 'mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm'

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'selling_price', label: 'Price: low to high' },
  { value: '-selling_price', label: 'Price: high to low' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'rating', label: 'Rating' },
]

function asQuery(params: URLSearchParams): ProductQuery {
  const flag = (key: string) => (params.get(key) === 'true' ? true : undefined)
  return {
    search: params.get('q') || undefined,
    category: params.get('category') || undefined,
    brand: params.get('brand') || undefined,
    min_price: params.get('min_price') || undefined,
    max_price: params.get('max_price') || undefined,
    availability: params.get('availability') || undefined,
    min_rating: params.get('min_rating') || undefined,
    min_discount: params.get('min_discount') || undefined,
    on_sale: flag('on_sale'),
    featured: flag('featured'),
    bestseller: flag('bestseller'),
    tag: params.get('tag') || undefined,
  }
}

export function ShopFilters({ lockedCategory }: { lockedCategory?: string }) {
  const [params, setParams] = useSearchParams()
  const query = asQuery(params)
  if (lockedCategory) query.category = lockedCategory
  const facets = useQuery({
    queryKey: ['product-facets', query],
    queryFn: () => catalogService.facets(query),
  })

  const chips = useMemo(() => {
    const items: { key: string; label: string }[] = []
    if (params.get('q')) items.push({ key: 'q', label: `“${params.get('q')}”` })
    if (params.get('brand')) items.push({ key: 'brand', label: params.get('brand') || 'Brand' })
    if (params.get('availability') === 'in_stock') items.push({ key: 'availability', label: 'In stock' })
    if (params.get('availability') === 'out_of_stock') items.push({ key: 'availability', label: 'Out of stock' })
    if (params.get('min_rating')) items.push({ key: 'min_rating', label: `${params.get('min_rating')}+ stars` })
    if (params.get('on_sale') === 'true') items.push({ key: 'on_sale', label: 'On sale' })
    if (params.get('min_discount')) items.push({ key: 'min_discount', label: `${params.get('min_discount')}% off` })
    if (params.get('min_price') || params.get('max_price')) {
      items.push({
        key: 'price',
        label: `₹${params.get('min_price') || '0'}–₹${params.get('max_price') || '∞'}`,
      })
    }
    if (params.get('tag')) items.push({ key: 'tag', label: `#${params.get('tag')}` })
    return items
  }, [params])

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next)
  }

  function clearKey(key: string) {
    const next = new URLSearchParams(params)
    if (key === 'price') {
      next.delete('min_price')
      next.delete('max_price')
    } else {
      next.delete(key)
    }
    next.delete('page')
    setParams(next)
  }

  function clearAll() {
    const next = new URLSearchParams()
    if (lockedCategory) next.set('category', lockedCategory)
    const ordering = params.get('ordering')
    if (ordering) next.set('ordering', ordering)
    setParams(next)
  }

  return (
    <aside className="space-y-5 rounded-2xl border border-line bg-white p-4 lg:sticky lg:top-28">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">Filters</h2>
        <button type="button" className="text-sm font-semibold text-pine" onClick={clearAll}>
          Clear
        </button>
      </div>

      {chips.length ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-medium text-ink"
              onClick={() => clearKey(chip.key)}
            >
              {chip.label} ×
            </button>
          ))}
        </div>
      ) : null}

      <label className="block text-sm font-medium" htmlFor="shop-search">
        Search
        <input
          id="shop-search"
          className={fieldClass}
          defaultValue={params.get('q') ?? ''}
          key={params.get('q') ?? ''}
          placeholder="Name, SKU, brand, tag…"
          onBlur={(event) => update('q', event.target.value.trim())}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              update('q', event.currentTarget.value.trim())
            }
          }}
        />
      </label>

      {lockedCategory ? null : (
        <fieldset>
          <legend className="text-sm font-medium">Category</legend>
          <div className="mt-2 space-y-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="category"
                checked={!params.get('category')}
                onChange={() => update('category', '')}
              />
              All
            </label>
            {(facets.data?.categories ?? []).map((category) => (
              <label key={category.slug} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="category"
                    checked={params.get('category') === category.slug}
                    onChange={() => update('category', category.slug)}
                  />
                  {category.name}
                </span>
                <span className="text-ink-soft">{category.count}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-medium">Brand</legend>
        <div className="mt-2 space-y-1.5">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="brand" checked={!params.get('brand')} onChange={() => update('brand', '')} />
            All
          </label>
          {(facets.data?.brands ?? []).map((brand) => (
            <label key={brand.slug} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="brand"
                  checked={params.get('brand') === brand.slug}
                  onChange={() => update('brand', brand.slug)}
                />
                {brand.name}
              </span>
              <span className="text-ink-soft">{brand.count}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Price (₹)</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            className={fieldClass}
            type="number"
            min={0}
            placeholder={facets.data?.min_price ? String(Math.floor(Number(facets.data.min_price))) : 'Min'}
            defaultValue={params.get('min_price') ?? ''}
            key={`min-${params.get('min_price') ?? ''}`}
            onBlur={(event) => update('min_price', event.target.value)}
          />
          <input
            className={fieldClass}
            type="number"
            min={0}
            placeholder={facets.data?.max_price ? String(Math.ceil(Number(facets.data.max_price))) : 'Max'}
            defaultValue={params.get('max_price') ?? ''}
            key={`max-${params.get('max_price') ?? ''}`}
            onBlur={(event) => update('max_price', event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Availability</legend>
        <div className="mt-2 space-y-1.5 text-sm">
          {[
            { value: '', label: 'All' },
            { value: 'in_stock', label: 'In stock' },
            { value: 'out_of_stock', label: 'Out of stock' },
          ].map((option) => (
            <label key={option.label} className="flex items-center gap-2">
              <input
                type="radio"
                name="availability"
                checked={(params.get('availability') ?? '') === option.value}
                onChange={() => update('availability', option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Rating</legend>
        <div className="mt-2 space-y-1.5 text-sm">
          {[
            { value: '', label: 'Any' },
            { value: '4', label: '4 stars and up' },
            { value: '3', label: '3 stars and up' },
            { value: '2', label: '2 stars and up' },
          ].map((option) => (
            <label key={option.label} className="flex items-center gap-2">
              <input
                type="radio"
                name="min_rating"
                checked={(params.get('min_rating') ?? '') === option.value}
                onChange={() => update('min_rating', option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Discount</legend>
        <div className="mt-2 space-y-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={params.get('on_sale') === 'true'}
              onChange={(event) => update('on_sale', event.target.checked ? 'true' : '')}
            />
            On sale
          </label>
          {[
            { value: '', label: 'Any discount' },
            { value: '10', label: '10% or more' },
            { value: '20', label: '20% or more' },
            { value: '30', label: '30% or more' },
          ].map((option) => (
            <label key={option.label} className="flex items-center gap-2">
              <input
                type="radio"
                name="min_discount"
                checked={(params.get('min_discount') ?? '') === option.value}
                onChange={() => update('min_discount', option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    </aside>
  )
}

export function ShopSortBar({ count }: { count?: number }) {
  const [params, setParams] = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-soft">
        {count == null ? 'Searching the live catalogue' : `${count} ${count === 1 ? 'product' : 'products'}`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium" htmlFor="shop-sort">
          Sort
          <select
            id="shop-sort"
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
            value={params.get('ordering') ?? 'relevance'}
            onChange={(event) => update('ordering', event.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium" htmlFor="shop-page-size">
          Per page
          <select
            id="shop-page-size"
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
            value={params.get('page_size') ?? '12'}
            onChange={(event) => update('page_size', event.target.value === '12' ? '' : event.target.value)}
          >
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="48">48</option>
          </select>
        </label>
      </div>
    </div>
  )
}

export function ShopFiltersToggle({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  return (
    <Button type="button" variant="ghost" className="lg:hidden" onClick={onToggle}>
      {open ? 'Hide filters' : 'Show filters'}
    </Button>
  )
}
