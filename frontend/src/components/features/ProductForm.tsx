import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, X } from 'lucide-react'
import { productsApi, tagsApi } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Product } from '@/types'

// ─── Sub-category options ─────────────────────────────────────────────────────

const SKINCARE_SUBS    = ['洗面乳','化妝水','精華液','乳液','乳霜','面膜','防曬','卸妝','眼霜','其他']
const SUPPLEMENT_SUBS  = ['維他命','礦物質','益生菌','魚油','膠原蛋白','葉黃素','蛋白質','其他']

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  name:        string
  brand:       string
  category:    'skincare' | 'supplement' | ''
  subCategory: string
  spec:        string
  barcode:     string
  notes:       string
  tagIds:      string[]
}

const EMPTY: FormState = {
  name: '', brand: '', category: '', subCategory: '',
  spec: '', barcode: '', notes: '', tagIds: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Props {
  /** Pass existing product to edit; undefined = create new */
  product?: Product
  onSuccess: () => void
  onCancel:  () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProductForm({ product, onSuccess, onCancel }: Props) {
  const toast        = useToast()
  const queryClient  = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = !!product

  const [form,    setForm]    = useState<FormState>(() =>
    product
      ? {
          name:        product.name,
          brand:       product.brand,
          category:    product.category,
          subCategory: product.subCategory ?? '',
          spec:        product.spec ?? '',
          barcode:     product.barcode ?? '',
          notes:       product.notes ?? '',
          tagIds:      product.tags.map((t) => t.id),
        }
      : EMPTY,
  )
  const [imageFile,    setImageFile]    = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>(product?.imageUrl ?? '')
  const [errors,       setErrors]       = useState<Partial<Record<keyof FormState, string>>>({})

  // Fetch tags
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn:  () => tagsApi.list().then((r) => r.data),
  })

  // Create / update mutation
  const mutation = useMutation({
    mutationFn: (fd: FormData) =>
      isEdit
        ? productsApi.update(product!.id, fd).then((r) => r.data)
        : productsApi.create(fd).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success(isEdit ? '產品已更新' : '產品已新增')
      onSuccess()
    },
    onError: () => {
      toast.error(isEdit ? '更新失敗，請重試' : '新增失敗，請重試')
    },
  })

  // ── Field helpers ──────────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.name.trim())     next.name     = '請輸入產品名稱'
    if (!form.brand.trim())    next.brand    = '請輸入品牌名稱'
    if (!form.category)        next.category = '請選擇分類'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Image handling ─────────────────────────────────────────────────────────

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Revoke object URL on unmount
  useEffect(() => {
    return () => { if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview) }
  }, [imagePreview])

  // ── Category change: reset sub-category ──────────────────────────────────

  function handleCategoryChange(val: FormState['category']) {
    setField('category', val)
    setField('subCategory', '')
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const fd = new FormData()
    fd.append('name',     form.name.trim())
    fd.append('brand',    form.brand.trim())
    fd.append('category', form.category)
    if (form.subCategory) fd.append('subCategory', form.subCategory)
    if (form.spec)        fd.append('spec',        form.spec.trim())
    if (form.barcode)     fd.append('barcode',     form.barcode.trim())
    if (form.notes)       fd.append('notes',       form.notes.trim())
    form.tagIds.forEach((id) => fd.append('tagIds', id))
    if (imageFile)        fd.append('image', imageFile)

    mutation.mutate(fd)
  }

  // ── Tag toggle ────────────────────────────────────────────────────────────

  function toggleTag(id: string) {
    setField(
      'tagIds',
      form.tagIds.includes(id)
        ? form.tagIds.filter((t) => t !== id)
        : [...form.tagIds, id],
    )
  }

  const subOptions = form.category === 'skincare' ? SKINCARE_SUBS
    : form.category === 'supplement'              ? SUPPLEMENT_SUBS
    : []

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">

      {/* Image upload */}
      <div className="flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-lg border-2 border-dashed border-surface-border bg-surface
                     flex items-center justify-center overflow-hidden relative cursor-pointer
                     hover:border-primary transition-colors"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="上傳產品圖片"
          onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click() }}
        >
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="產品圖片預覽"
              className="w-full h-full object-cover"
            />
          ) : (
            <Upload size={24} className="text-ink-faint" aria-hidden="true" />
          )}
        </div>
        <div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={() => fileInputRef.current?.click()}>
              選擇圖片
            </button>
            {imagePreview && (
              <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={clearImage} aria-label="移除圖片">
                移除
              </button>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-1.5">JPG、PNG、WebP，最大 5MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={handleImageChange}
            aria-label="上傳產品圖片"
          />
        </div>
      </div>

      {/* Name */}
      <Field label="產品名稱" required error={errors.name}>
        <input
          id="name"
          className="input"
          placeholder="例：LANEIGE 水庫保濕精華"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          autoComplete="off"
        />
      </Field>

      {/* Brand */}
      <Field label="品牌" required error={errors.brand}>
        <input
          id="brand"
          className="input"
          placeholder="例：LANEIGE"
          value={form.brand}
          onChange={(e) => setField('brand', e.target.value)}
          autoComplete="off"
        />
      </Field>

      {/* Category + Sub-category (2 col) */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="分類" required error={errors.category}>
          <select
            id="category"
            className="input"
            value={form.category}
            onChange={(e) => handleCategoryChange(e.target.value as FormState['category'])}
          >
            <option value="">請選擇…</option>
            <option value="skincare">保養品</option>
            <option value="supplement">保健食品</option>
          </select>
        </Field>

        <Field label="子分類">
          <select
            id="subCategory"
            className="input"
            value={form.subCategory}
            onChange={(e) => setField('subCategory', e.target.value)}
            disabled={!form.category}
          >
            <option value="">不指定</option>
            {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      {/* Spec + Barcode (2 col) */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="規格">
          <input
            id="spec"
            className="input"
            placeholder="例：50ml、60錠"
            value={form.spec}
            onChange={(e) => setField('spec', e.target.value)}
          />
        </Field>
        <Field label="條碼 / EAN">
          <input
            id="barcode"
            className="input"
            placeholder="掃碼或手動輸入"
            value={form.barcode}
            onChange={(e) => setField('barcode', e.target.value)}
          />
        </Field>
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div>
          <p className="text-sm font-medium text-ink mb-2">標籤</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="選擇標籤">
            {allTags.map((tag) => {
              const selected = form.tagIds.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors
                    ${selected
                      ? 'text-white border-transparent'
                      : 'text-ink-muted border-surface-border hover:border-primary hover:text-primary'}`}
                  style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                  aria-pressed={selected}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      <Field label="備註">
        <textarea
          id="notes"
          className="input resize-none"
          rows={3}
          placeholder="其他補充說明…"
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
        />
      </Field>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending ? <LoadingSpinner size="sm" /> : isEdit ? '儲存變更' : '新增產品'}
        </button>
      </div>
    </form>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactElement<{ id?: string }>
}) {
  const id = children.props.id ?? label

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1">
        {label}
        {required && <span className="text-status-danger ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-status-danger mt-1">
          {error}
        </p>
      )}
    </div>
  )
}
