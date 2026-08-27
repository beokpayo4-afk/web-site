import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AdminPage } from '@/components/admin/AdminPage'
import { AdminTable, AdminToolbar, ConfirmDialog } from '@/components/admin/AdminTable'
import { CatalogPagination } from '@/components/product/CatalogPagination'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useAdminToast } from '@/hooks/admin-toast-context'
import { getErrorMessage } from '@/lib/api'
import { formatDate, formatMoney } from '@/lib/format'
import { adminService } from '@/services/admin'
import type { AdminProduct } from '@/types/api'

const PAGE_SIZE = 12

function StockBadge({ product }: { product: AdminProduct }) {
  const status = product.stock_status ?? (product.stock_quantity <= 0 ? 'out_of_stock' : product.stock_quantity <= 5 ? 'low_stock' : 'in_stock')
  const label = status === 'out_of_stock' ? 'Out of Stock' : status === 'low_stock' ? 'Low Stock' : 'In Stock'
  const tone =
    status === 'out_of_stock' ? 'bg-red-100 text-red-800' : status === 'low_stock' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
}

function StatusBadge({ status }: { status: AdminProduct['status'] }) {
  const tone =
    status === 'PUBLISHED' ? 'bg-pine/10 text-pine' : status === 'DRAFT' ? 'bg-paper-2 text-ink-soft' : 'bg-clay/15 text-clay'
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{status}</span>
}

export function AdminProductsPage() {
  const [params, setParams] = useSearchParams()
  const toast = useAdminToast()
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null)

  const search = params.get('search') ?? ''
  const page = Number(params.get('page') ?? 1)
  const category = params.get('category') ?? ''
  const brand = params.get('brand') ?? ''
  const status = params.get('status') ?? ''
  const stock = params.get('stock') ?? ''
  const featured = params.get('is_featured') ?? ''
  const bestseller = params.get('is_bestseller') ?? ''
  const ordering = params.get('ordering') ?? '-created_at'

  const products = useQuery({
    queryKey: ['admin-products', search, page, category, brand, status, stock, featured, bestseller, ordering],
    queryFn: () =>
      adminService.products({
        search: search || undefined,
        page,
        page_size: PAGE_SIZE,
        category: category || undefined,
        brand: brand || undefined,
        status: status || undefined,
        stock: stock || undefined,
        is_featured: featured || undefined,
        is_bestseller: bestseller || undefined,
        ordering,
      }),
  })
  const categories = useQuery({ queryKey: ['admin-categories-all'], queryFn: () => adminService.categories({ page_size: 100 }) })
  const brands = useQuery({ queryKey: ['admin-brands-all'], queryFn: () => adminService.brands({ page_size: 100 }) })

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  const remove = useMutation({
    mutationFn: (id: number) => adminService.deactivateProduct(id),
    onSuccess: async () => {
      toast.push('Product unpublished and removed from the storefront.')
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
    onError: (err) => toast.push(getErrorMessage(err, 'Could not delete product.'), 'error'),
  })

  const setStatus = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'publish' | 'unpublish' }) => adminService.setProductStatus(id, action),
    onSuccess: async (_data, vars) => {
      toast.push(vars.action === 'publish' ? 'Product published.' : 'Product unpublished.')
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
    onError: (err) => toast.push(getErrorMessage(err, 'Could not update status.'), 'error'),
  })

  const rows = products.data?.results ?? []

  return (
    <AdminPage
      title="Products"
      error={products.error}
      actions={
        <Link to="/admin/products/new">
          <Button>Add Product</Button>
        </Link>
      }
    >
      <AdminToolbar>
        <Input
          label="Search name or SKU"
          value={search}
          onChange={(event) => update('search', event.target.value)}
          placeholder="Harbor Pulse…"
          className="min-w-56"
        />
        <Select label="Category" value={category} onChange={(event) => update('category', event.target.value)}>
          <option value="">All categories</option>
          {(categories.data?.results ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
        <Select label="Brand" value={brand} onChange={(event) => update('brand', event.target.value)}>
          <option value="">All brands</option>
          {(brands.data?.results ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
        <Select label="Status" value={status} onChange={(event) => update('status', event.target.value)}>
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="UNPUBLISHED">Unpublished</option>
        </Select>
        <Select label="Stock" value={stock} onChange={(event) => update('stock', event.target.value)}>
          <option value="">All stock</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </Select>
        <Select label="Featured" value={featured} onChange={(event) => update('is_featured', event.target.value)}>
          <option value="">Any</option>
          <option value="true">Featured</option>
          <option value="false">Not featured</option>
        </Select>
        <Select label="Bestseller" value={bestseller} onChange={(event) => update('is_bestseller', event.target.value)}>
          <option value="">Any</option>
          <option value="true">Bestseller</option>
          <option value="false">Not bestseller</option>
        </Select>
        <Select label="Sort" value={ordering} onChange={(event) => update('ordering', event.target.value)}>
          <option value="-created_at">Newest</option>
          <option value="created_at">Oldest</option>
          <option value="selling_price">Price ↑</option>
          <option value="-selling_price">Price ↓</option>
          <option value="stock_quantity">Stock ↑</option>
          <option value="-stock_quantity">Stock ↓</option>
        </Select>
      </AdminToolbar>

      {products.isLoading ? <p className="text-sm text-ink-soft">Loading products…</p> : null}
      {!products.isLoading && rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-sm text-ink-soft">No products match these filters.</p>
      ) : null}

      {rows.length ? (
        <AdminTable
          columns={['Image', 'Product', 'SKU', 'Category', 'Brand', 'Price', 'MRP', 'GST', 'Stock', 'Flags', 'Status', 'Created', 'Actions']}
        >
          {rows.map((product) => (
            <tr key={product.id} className="border-b border-line/70 align-top last:border-0">
              <td className="px-3 py-3">
                {product.primary_image || product.images[0]?.image ? (
                  <img
                    src={product.primary_image || product.images[0]?.image}
                    alt=""
                    className="size-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-lg bg-paper-2 text-xs text-ink-soft">No img</div>
                )}
              </td>
              <td className="px-3 py-3">
                <Link to={`/admin/products/${product.id}`} className="font-semibold text-pine">
                  {product.name}
                </Link>
              </td>
              <td className="px-3 py-3 font-mono text-xs">{product.sku}</td>
              <td className="px-3 py-3">{product.category_name}</td>
              <td className="px-3 py-3">{product.brand_name || '—'}</td>
              <td className="px-3 py-3">{formatMoney(product.selling_price)}</td>
              <td className="px-3 py-3">{formatMoney(product.mrp)}</td>
              <td className="px-3 py-3">{product.gst_rate ? `${Number(product.gst_rate)}%` : '—'}</td>
              <td className="px-3 py-3">
                <div className="space-y-1">
                  <p>{product.stock_quantity}</p>
                  <StockBadge product={product} />
                </div>
              </td>
              <td className="px-3 py-3 text-xs">
                {product.is_featured ? <p>Featured</p> : null}
                {product.is_bestseller ? <p>Bestseller</p> : null}
                {!product.is_featured && !product.is_bestseller ? '—' : null}
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={product.status} />
              </td>
              <td className="px-3 py-3 text-xs text-ink-soft">{formatDate(product.created_at)}</td>
              <td className="px-3 py-3">
                <div className="flex flex-col items-start gap-1 text-xs font-semibold">
                  <Link to={`/admin/products/${product.id}`} className="text-pine">
                    View
                  </Link>
                  <Link to={`/admin/products/${product.id}/edit`} className="text-pine">
                    Edit
                  </Link>
                  {product.status === 'PUBLISHED' ? (
                    <button type="button" className="text-clay" onClick={() => setStatus.mutate({ id: product.id, action: 'unpublish' })}>
                      Unpublish
                    </button>
                  ) : (
                    <button type="button" className="text-pine" onClick={() => setStatus.mutate({ id: product.id, action: 'publish' })}>
                      Publish
                    </button>
                  )}
                  <button type="button" className="text-red-700" onClick={() => setPendingDelete(product)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : null}

      {products.data ? <CatalogPagination count={products.data.count} pageSize={PAGE_SIZE} /> : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete product?"
        body="Are you sure you want to delete this product? It will be unpublished and hidden from the storefront. Order history stays intact."
        confirmLabel="Delete"
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </AdminPage>
  )
}
