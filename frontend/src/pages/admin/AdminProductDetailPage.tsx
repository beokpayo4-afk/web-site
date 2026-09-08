import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AdminPage } from '@/components/admin/AdminPage'
import { ConfirmDialog } from '@/components/admin/AdminTable'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAdminToast } from '@/hooks/admin-toast-context'
import { getErrorMessage } from '@/lib/api'
import { formatDate, formatMoney } from '@/lib/format'
import { adminService } from '@/services/admin'

export function AdminProductDetailPage() {
  const { id = '' } = useParams()
  const productId = Number(id)
  const navigate = useNavigate()
  const toast = useAdminToast()
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState(false)

  const product = useQuery({
    queryKey: ['admin-product', productId],
    queryFn: () => adminService.product(productId),
    enabled: Number.isFinite(productId),
  })

  const setStatus = useMutation({
    mutationFn: (action: 'publish' | 'unpublish') => adminService.setProductStatus(productId, action),
    onSuccess: async (_data, action) => {
      toast.push(action === 'publish' ? 'Product published.' : 'Product unpublished.')
      await queryClient.invalidateQueries({ queryKey: ['admin-product', productId] })
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
    onError: (err) => toast.push(getErrorMessage(err, 'Could not update status.'), 'error'),
  })

  const remove = useMutation({
    mutationFn: () => adminService.deactivateProduct(productId),
    onSuccess: async () => {
      toast.push('Product deleted from storefront.')
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      navigate('/admin/products')
    },
    onError: (err) => toast.push(getErrorMessage(err, 'Could not delete product.'), 'error'),
  })

  if (product.isLoading) return <p className="text-sm text-ink-soft">Loading product…</p>
  if (product.isError || !product.data) return <AdminPage title="Product" error={product.error}><div /></AdminPage>

  const data = product.data
  const images = data.images ?? []

  return (
    <AdminPage
      title={data.name}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/products" className="text-sm font-semibold text-pine self-center">
            Back
          </Link>
          <Link to={`/admin/products/${data.id}/edit`}>
            <Button>Edit Product</Button>
          </Link>
          {data.status === 'PUBLISHED' ? (
            <Button type="button" variant="ghost" onClick={() => setStatus.mutate('unpublish')}>
              Unpublish
            </Button>
          ) : (
            <Button type="button" onClick={() => setStatus.mutate('publish')}>
              Publish
            </Button>
          )}
          <Button type="button" className="bg-red-700 hover:bg-red-800" onClick={() => setPendingDelete(true)}>
            Delete
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {(images.length ? images : [{ id: 0, image: data.primary_image || '', alt_text: data.name, is_primary: true }]).map((image) =>
              image.image ? (
                <img key={image.id || 'primary'} src={image.image} alt={image.alt_text || data.name} className="aspect-square w-full rounded-xl object-cover" />
              ) : null,
            )}
          </div>
          {!images.length && !data.primary_image ? <p className="text-sm text-ink-soft">No image links yet.</p> : null}
        </Card>
        <Card className="space-y-3 p-5 text-sm">
          <dl className="space-y-2">
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">SKU</dt><dd className="font-mono">{data.sku}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">Category</dt><dd>{data.category_name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">Brand</dt><dd>{data.brand_name || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">Price</dt><dd>{formatMoney(data.selling_price)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">MRP</dt><dd>{formatMoney(data.mrp)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">Discount</dt><dd>{formatMoney(data.discount_amount)} ({data.discount_percent}%)</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">GST</dt><dd>{data.gst_rate ? `${Number(data.gst_rate)}% · ${formatMoney(data.gst_amount || 0)}` : data.tax_class_name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">Stock</dt><dd>{data.stock_quantity} · {data.stock_status?.replaceAll('_', ' ')}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">Status</dt><dd>{data.status}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">Featured</dt><dd>{data.is_featured ? 'Yes' : 'No'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">Bestseller</dt><dd>{data.is_bestseller ? 'Yes' : 'No'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-soft">Created</dt><dd>{formatDate(data.created_at)}</dd></div>
          </dl>
        </Card>
      </div>
      <Card className="space-y-3 p-5">
        <h2 className="font-display text-xl">Description</h2>
        <p className="text-sm text-ink-soft">{data.short_description || 'No short description.'}</p>
        <p className="whitespace-pre-wrap text-sm">{data.description || 'No description.'}</p>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-display text-xl">Specifications</h2>
        {Object.keys(data.specifications || {}).length ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            {Object.entries(data.specifications).map(([key, value]) => (
              <div key={key} className="rounded-xl bg-paper-2 px-3 py-2 text-sm">
                <dt className="text-ink-soft">{key}</dt>
                <dd className="font-medium">{String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-ink-soft">No specifications.</p>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete}
        title="Delete product?"
        body="Are you sure you want to delete this product?"
        confirmLabel="Delete"
        pending={remove.isPending}
        onCancel={() => setPendingDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </AdminPage>
  )
}
