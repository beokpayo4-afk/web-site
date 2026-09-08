import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AdminPage } from '@/components/admin/AdminPage'
import { CheckboxField, ConfirmDialog } from '@/components/admin/AdminTable'
import { Button } from '@/components/ui/Button'
import { Alert, Card } from '@/components/ui/Card'
import { Input, Select, TextArea } from '@/components/ui/Input'
import { useAdminToast } from '@/hooks/admin-toast-context'
import { getErrorMessage } from '@/lib/api'
import { slugify } from '@/lib/adminAccess'
import { formatMoney } from '@/lib/format'
import { adminService } from '@/services/admin'
import type { AdminProduct, ProductImage, TaxClass } from '@/types/api'

type SpecRow = { name: string; value: string }
type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED'

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function specsToRows(specs: Record<string, string | number | boolean> | undefined): SpecRow[] {
  const entries = Object.entries(specs ?? {})
  if (!entries.length) return [{ name: '', value: '' }]
  return entries.map(([name, value]) => ({ name, value: String(value) }))
}

function rowsToSpecs(rows: SpecRow[]) {
  const next: Record<string, string> = {}
  for (const row of rows) {
    const name = row.name.trim()
    if (!name) continue
    next[name] = row.value.trim()
  }
  return next
}

function ProductEditor({
  isNew,
  productId,
  initial,
  defaultTaxClassId,
  categories,
  brands,
  taxClasses,
}: {
  isNew: boolean
  productId: number | null
  initial?: AdminProduct
  defaultTaxClassId: string
  categories: { id: number; name: string }[]
  brands: { id: number; name: string }[]
  taxClasses: TaxClass[]
}) {
  const navigate = useNavigate()
  const toast = useAdminToast()
  const queryClient = useQueryClient()

  const [name, setName] = useState(initial?.name ?? '')
  const [sku, setSku] = useState(initial?.sku ?? '')
  const [category, setCategory] = useState(initial ? String(initial.category) : '')
  const [brand, setBrand] = useState(initial?.brand ? String(initial.brand) : '')
  const [price, setPrice] = useState(initial?.selling_price ?? '')
  const [mrp, setMrp] = useState(initial?.mrp ?? '')
  const [taxClass, setTaxClass] = useState(initial ? String(initial.tax_class) : defaultTaxClassId)
  const [stock, setStock] = useState(String(initial?.stock_quantity ?? 0))
  const [shortDescription, setShortDescription] = useState(initial?.short_description ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [specs, setSpecs] = useState<SpecRow[]>(specsToRows(initial?.specifications))
  const [featured, setFeatured] = useState(initial?.is_featured ?? false)
  const [bestseller, setBestseller] = useState(initial?.is_bestseller ?? false)
  const [status, setStatus] = useState<ProductStatus>(initial?.status ?? 'DRAFT')
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pendingDelete, setPendingDelete] = useState(false)
  const [savingImage, setSavingImage] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [images, setImages] = useState<ProductImage[]>(initial?.images ?? [])

  const selectedTax = taxClasses.find((row) => String(row.id) === taxClass)
  const gstRate = selectedTax ? Number(selectedTax.igst_rate) : 0
  const selling = Number(price || 0)
  const list = Number(mrp || selling || 0)
  const discountAmount = list > selling ? list - selling : 0
  const discountPercent = list > 0 ? Math.round((discountAmount / list) * 100) : 0
  const gstAmount = selling * (gstRate / 100)

  function validate() {
    const errors: Record<string, string> = {}
    if (name.trim().length < 2) errors.name = 'Product name is required.'
    if (sku.trim().length < 3) errors.sku = 'SKU is required.'
    if (!category) errors.category = 'Category is required.'
    if (price === '' || Number.isNaN(Number(price)) || Number(price) < 0) errors.price = 'Enter a valid selling price.'
    if (stock === '' || Number.isNaN(Number(stock)) || Number(stock) < 0 || !Number.isInteger(Number(stock))) {
      errors.stock = 'Stock must be a whole number ≥ 0.'
    }
    if (mrp !== '' && (Number.isNaN(Number(mrp)) || Number(mrp) < 0)) errors.mrp = 'Enter a valid MRP.'
    if (mrp !== '' && Number(mrp) < Number(price || 0)) errors.mrp = 'MRP must be greater than or equal to selling price.'
    if (!taxClass) errors.tax_class = 'Select a GST tax class.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function buildPayload(nextStatus: ProductStatus) {
    const sellingPrice = Number(price).toFixed(2)
    const mrpValue = mrp === '' ? sellingPrice : Number(mrp).toFixed(2)
    return {
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      slug: slugify(sku.trim() || name.trim()),
      category: Number(category),
      brand: brand ? Number(brand) : null,
      selling_price: sellingPrice,
      mrp: mrpValue,
      tax_class: Number(taxClass),
      stock_quantity: Number(stock),
      initial_quantity: Number(stock),
      short_description: shortDescription.trim(),
      description: description.trim(),
      specifications: rowsToSpecs(specs),
      is_featured: featured,
      is_bestseller: bestseller,
      status: nextStatus,
    }
  }

  const save = useMutation({
    mutationFn: async (nextStatus: ProductStatus) => {
      const payload = buildPayload(nextStatus)
      return isNew ? adminService.createProduct(payload) : adminService.updateProduct(productId!, payload)
    },
    onSuccess: async (saved) => {
      toast.push(saved.status === 'PUBLISHED' ? 'Product published.' : 'Product saved.')
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-product', saved.id] })
      if (isNew) navigate(`/admin/products/${saved.id}/edit`, { replace: true })
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not save product.')
      setFormError(message)
      toast.push(message, 'error')
    },
  })

  const remove = useMutation({
    mutationFn: () => adminService.deactivateProduct(productId!),
    onSuccess: async () => {
      toast.push('Product deleted from storefront.')
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      navigate('/admin/products')
    },
    onError: (err) => toast.push(getErrorMessage(err, 'Could not delete product.'), 'error'),
  })

  async function refreshImages(id: number) {
    const fresh = await adminService.product(id)
    setImages(fresh.images)
  }

  async function addImageLink() {
    if (!productId) return
    const url = imageUrl.trim()
    if (!isHttpUrl(url)) {
      toast.push('Enter a valid image URL starting with http:// or https://', 'error')
      return
    }
    setSavingImage(true)
    try {
      await adminService.addProductImage(productId, { image: url, is_primary: images.length === 0 })
      setImageUrl('')
      await refreshImages(productId)
      toast.push('Image link added.')
    } catch (err) {
      toast.push(getErrorMessage(err, 'Could not add image link.'), 'error')
    } finally {
      setSavingImage(false)
    }
  }

  async function setPrimary(image: ProductImage) {
    if (!productId) return
    try {
      await adminService.updateProductImage(productId, image.id, { is_primary: true })
      await refreshImages(productId)
      toast.push('Primary image updated.')
    } catch (err) {
      toast.push(getErrorMessage(err, 'Could not set primary image.'), 'error')
    }
  }

  async function removeImage(image: ProductImage) {
    if (!productId) return
    try {
      await adminService.deleteProductImage(productId, image.id)
      await refreshImages(productId)
      toast.push('Image removed.')
    } catch (err) {
      toast.push(getErrorMessage(err, 'Could not remove image.'), 'error')
    }
  }

  async function moveImage(image: ProductImage, direction: -1 | 1) {
    if (!productId) return
    const ordered = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const index = ordered.findIndex((row) => row.id === image.id)
    const swapWith = ordered[index + direction]
    if (!swapWith) return
    try {
      await Promise.all([
        adminService.updateProductImage(productId, image.id, { sort_order: swapWith.sort_order ?? index + direction }),
        adminService.updateProductImage(productId, swapWith.id, { sort_order: image.sort_order ?? index }),
      ])
      await refreshImages(productId)
    } catch (err) {
      toast.push(getErrorMessage(err, 'Could not reorder images.'), 'error')
    }
  }

  return (
    <>
      {formError ? <Alert>{formError}</Alert> : null}
      <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="font-display text-xl">Basic information</h2>
            <Input label="Product Name *" value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} required />
            <Input label="SKU *" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} error={fieldErrors.sku} required />
            <Select label="Category *" value={category} onChange={(e) => setCategory(e.target.value)} error={fieldErrors.category} required>
              <option value="">Select category</option>
              {categories.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </Select>
            <Select label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">No brand</option>
              {brands.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </Select>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display text-xl">Pricing</h2>
            <Input label="Price *" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} error={fieldErrors.price} required />
            <Input label="MRP" type="number" min={0} step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} error={fieldErrors.mrp} />
            <Select label="GST *" value={taxClass} onChange={(e) => setTaxClass(e.target.value)} error={fieldErrors.tax_class} required>
              <option value="">Select GST</option>
              {taxClasses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} ({Number(row.igst_rate)}%)
                </option>
              ))}
            </Select>
            <dl className="grid grid-cols-2 gap-2 rounded-xl bg-paper-2 p-3 text-sm">
              <div>
                <dt className="text-ink-soft">Discount</dt>
                <dd className="font-semibold">
                  {formatMoney(discountAmount)} ({discountPercent}%)
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft">GST amount</dt>
                <dd className="font-semibold">{formatMoney(gstAmount)}</dd>
              </div>
            </dl>
            <p className="text-xs text-ink-soft">Prices are GST-exclusive. Checkout adds GST from the tax class.</p>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display text-xl">Inventory</h2>
            <Input label="Stock *" type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} error={fieldErrors.stock} required />
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display text-xl">Product settings</h2>
            <CheckboxField label="Featured?" checked={featured} onChange={setFeatured} />
            <CheckboxField label="Bestseller?" checked={bestseller} onChange={setBestseller} />
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="UNPUBLISHED">Unpublished</option>
            </Select>
          </Card>
        </div>

        <Card className="space-y-3">
          <h2 className="font-display text-xl">Description</h2>
          <TextArea
            label={`Short Description (${shortDescription.length}/280)`}
            value={shortDescription}
            maxLength={280}
            onChange={(e) => setShortDescription(e.target.value)}
          />
          <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-40" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Specifications</p>
            {specs.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  label="Name"
                  value={row.name}
                  onChange={(e) => setSpecs((current) => current.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)))}
                />
                <Input
                  label="Value"
                  value={row.value}
                  onChange={(e) => setSpecs((current) => current.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="self-end"
                  onClick={() => setSpecs((current) => (current.length === 1 ? [{ name: '', value: '' }] : current.filter((_, i) => i !== index)))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" onClick={() => setSpecs((current) => [...current, { name: '', value: '' }])}>
              Add Specification
            </Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl">Product images</h2>
          {isNew ? (
            <p className="text-sm text-ink-soft">Save the product first, then paste image links.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Image URL"
                    type="url"
                    placeholder="https://example.com/product.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void addImageLink()
                      }
                    }}
                  />
                </div>
                <Button type="button" disabled={savingImage || !imageUrl.trim()} onClick={() => void addImageLink()}>
                  {savingImage ? 'Adding…' : 'Add image'}
                </Button>
              </div>
              {isHttpUrl(imageUrl.trim()) ? (
                <img src={imageUrl.trim()} alt="" className="h-24 w-24 rounded-lg object-cover" />
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {images.map((image) => (
                  <div key={image.id} className="rounded-xl border border-line p-2">
                    <img src={image.image} alt={image.alt_text || ''} className="aspect-square w-full rounded-lg object-cover" />
                    <p className="mt-1 truncate text-[11px] text-ink-soft" title={image.image}>
                      {image.image}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                      {image.is_primary ? (
                        <span className="text-pine">Primary</span>
                      ) : (
                        <button type="button" className="text-pine" onClick={() => void setPrimary(image)}>
                          Set primary
                        </button>
                      )}
                      <button type="button" className="text-ink-soft" onClick={() => void moveImage(image, -1)}>
                        Up
                      </button>
                      <button type="button" className="text-ink-soft" onClick={() => void moveImage(image, 1)}>
                        Down
                      </button>
                      <button type="button" className="text-red-700" onClick={() => void removeImage(image)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => {
              if (!validate()) return
              save.mutate('DRAFT')
            }}
          >
            Save Draft
          </Button>
          <Button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              if (!validate()) return
              save.mutate('PUBLISHED')
            }}
          >
            Publish Product
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/admin/products')}>
            Cancel
          </Button>
          {!isNew ? (
            <Button type="button" className="bg-red-700 hover:bg-red-800" onClick={() => setPendingDelete(true)}>
              Delete
            </Button>
          ) : null}
        </div>
      </form>

      <ConfirmDialog
        open={pendingDelete}
        title="Delete product?"
        body="Are you sure you want to delete this product?"
        confirmLabel="Delete"
        pending={remove.isPending}
        onCancel={() => setPendingDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}

export function AdminProductFormPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const productId = isNew ? null : Number(id)

  const product = useQuery({
    queryKey: ['admin-product', productId],
    queryFn: () => adminService.product(productId!),
    enabled: productId != null && !Number.isNaN(productId),
  })
  const categories = useQuery({ queryKey: ['admin-categories-all'], queryFn: () => adminService.categories({ page_size: 100 }) })
  const brands = useQuery({ queryKey: ['admin-brands-all'], queryFn: () => adminService.brands({ page_size: 100 }) })
  const taxClasses = useQuery({ queryKey: ['admin-tax-classes'], queryFn: adminService.taxClasses })

  const defaultTaxClassId = useMemo(() => {
    const rows = taxClasses.data ?? []
    const preferred = rows.find((row) => Number(row.igst_rate) === 18) ?? rows[0]
    return preferred ? String(preferred.id) : ''
  }, [taxClasses.data])

  const title = isNew ? 'Add Product' : `Edit ${product.data?.name ?? 'Product'}`
  const ready = isNew
    ? Boolean(categories.data && brands.data && taxClasses.data)
    : Boolean(product.data && categories.data && brands.data && taxClasses.data)

  if (!isNew && product.isLoading) return <p className="text-sm text-ink-soft">Loading product…</p>
  if (!isNew && product.isError) {
    return (
      <AdminPage title="Product" error={product.error}>
        <div />
      </AdminPage>
    )
  }

  return (
    <AdminPage
      title={title}
      actions={
        <Link to="/admin/products" className="text-sm font-semibold text-pine">
          Back to products
        </Link>
      }
    >
      {!ready ? <p className="text-sm text-ink-soft">Loading form…</p> : null}
      {ready ? (
        <ProductEditor
          key={isNew ? `new-${defaultTaxClassId}` : `${product.data!.id}-${product.data!.updated_at}`}
          isNew={isNew}
          productId={productId}
          initial={product.data}
          defaultTaxClassId={defaultTaxClassId}
          categories={categories.data?.results ?? []}
          brands={brands.data?.results ?? []}
          taxClasses={taxClasses.data ?? []}
        />
      ) : null}
    </AdminPage>
  )
}
