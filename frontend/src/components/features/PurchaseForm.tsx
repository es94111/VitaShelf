import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { productsApi, purchasesApi } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { PurchaseRecord } from '@/types'

// ─── Channels ─────────────────────────────────────────────────────────────────

const CHANNELS = ['官網', 'iHerb', '屈臣氏', 'Costco', '蝦皮', 'Pinkoi', '藥妝店', '其他']

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  productId:       string
  purchaseDate:    string
  quantity:        string
  unitPrice:       string
  totalPrice:      string
  channel:         string
  expiryDate:      string
  manufactureDate: string
  openedDate:      string
  paoMonths:       string
  notes:           string
}

const today = format(new Date(), 'yyyy-MM-dd')

const EMPTY: FormState = {
  productId:       '',
  purchaseDate:    today,
  quantity:        '1',
  unitPrice:       '',
  totalPrice:      '',
  channel:         '',
  expiryDate:      '',
  manufactureDate: '',
  openedDate:      '',
  paoMonths:       '',
  notes:           '',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Pass to edit an existing record */
  purchase?: PurchaseRecord
  /** Pre-select a product (e.g. when opened from ProductDetail) */
  preselectedProductId?: string
  onSuccess: () => void
  onCancel:  () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PurchaseForm({ purchase, preselectedProductId, onSuccess, onCancel }: Props) {
  const toast       = useToast()
  const queryClient = useQueryClient()
  const isEdit      = !!purchase

  const [form,        setForm]        = useState<FormState>(() => {
    if (purchase) {
      return {
        productId:       purchase.productId,
        purchaseDate:    purchase.purchaseDate.slice(0, 10),
        quantity:        String(purchase.quantity),
        unitPrice:       purchase.unitPrice != null ? String(purchase.unitPrice) : '',
        totalPrice:      purchase.totalPrice != null ? String(purchase.totalPrice) : '',
        channel:         purchase.channel ?? '',
        expiryDate:      purchase.expiryDate.slice(0, 10),
        manufactureDate: purchase.manufactureDate?.slice(0, 10) ?? '',
        openedDate:      purchase.openedDate?.slice(0, 10) ?? '',
        paoMonths:       purchase.paoMonths != null ? String(purchase.paoMonths) : '',
        notes:           purchase.notes ?? '',
      }
    }
    return { ...EMPTY, productId: preselectedProductId ?? '' }
  })
  const [errors,      setErrors]      = useState<Partial<Record<keyof FormState, string>>>({})
  const [showAdvanced, setShowAdvanced] = useState(
    // Auto-expand if editing a record that has advanced fields
    !!(purchase?.manufactureDate || purchase?.openedDate || purchase?.paoMonths),
  )

  // ── Fetch all products for the dropdown ──────────────────────────────────

  const { data: productsData } = useQuery({
    queryKey: ['products', { pageSize: 200 }],
    queryFn:  () => productsApi.list({ pageSize: 200 }).then((r) => r.data),
  })
  const products = productsData?.data ?? []

  // ── Auto-calculate total price ────────────────────────────────────────────

  useEffect(() => {
    const qty  = parseFloat(form.quantity)
    const unit = parseFloat(form.unitPrice)
    if (!isNaN(qty) && !isNaN(unit) && qty > 0 && unit > 0) {
      setForm((prev) => ({ ...prev, totalPrice: (qty * unit).toFixed(0) }))
    }
  }, [form.quantity, form.unitPrice])

  // ── Field helpers ─────────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function handleBlurValidate(key: keyof FormState) {
    const next = { ...errors }
    const val  = form[key]

    if (key === 'productId'    && !val)  next.productId    = '請選擇產品'
    else if (key === 'purchaseDate' && !val) next.purchaseDate = '請填入購買日期'
    else if (key === 'quantity' && (!val || Number(val) < 1)) next.quantity = '數量至少為 1'
    else if (key === 'expiryDate' && !val) next.expiryDate = '請填入有效日期'
    else delete next[key]

    setErrors(next)
  }

  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.productId)               next.productId    = '請選擇產品'
    if (!form.purchaseDate)            next.purchaseDate = '請填入購買日期'
    if (!form.quantity || Number(form.quantity) < 1) next.quantity = '數量至少為 1'
    if (!form.expiryDate)              next.expiryDate   = '請填入有效日期'
    if (form.expiryDate && form.purchaseDate && form.expiryDate < form.purchaseDate)
      next.expiryDate = '有效日期不可早於購買日期'
    setErrors(next)

    // Auto-focus first error field
    if (Object.keys(next).length > 0) {
      const firstKey = Object.keys(next)[0]
      document.getElementById(firstKey)?.focus()
    }

    return Object.keys(next).length === 0
  }

  // ── Mutation ──────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: (data: Partial<PurchaseRecord>) =>
      isEdit
        ? purchasesApi.update(purchase!.id, data).then((r) => r.data)
        : purchasesApi.create(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-expiring'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-expired'] })
      toast.success(isEdit ? '購買紀錄已更新' : '購買紀錄已新增')
      onSuccess()
    },
    onError: () => toast.error(isEdit ? '更新失敗，請重試' : '新增失敗，請重試'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    mutation.mutate({
      productId:       form.productId,
      purchaseDate:    form.purchaseDate,
      quantity:        Number(form.quantity),
      unitPrice:       form.unitPrice  ? Number(form.unitPrice)  : undefined,
      totalPrice:      form.totalPrice ? Number(form.totalPrice) : undefined,
      channel:         form.channel    || undefined,
      expiryDate:      form.expiryDate,
      manufactureDate: form.manufactureDate || undefined,
      openedDate:      form.openedDate     || undefined,
      paoMonths:       form.paoMonths      ? Number(form.paoMonths) : undefined,
      notes:           form.notes          || undefined,
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">

      {/* Product selector */}
      <Field label="產品" required error={errors.productId}>
        <select
          id="productId"
          className="input"
          value={form.productId}
          onChange={(e) => setField('productId', e.target.value)}
          onBlur={() => handleBlurValidate('productId')}
          disabled={!!preselectedProductId}
        >
          <option value="">請選擇產品…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.brand}
            </option>
          ))}
        </select>
      </Field>

      {/* Purchase date + Quantity */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="購買日期" required error={errors.purchaseDate}>
          <input
            id="purchaseDate"
            type="date"
            className="input"
            value={form.purchaseDate}
            max={today}
            onChange={(e) => setField('purchaseDate', e.target.value)}
            onBlur={() => handleBlurValidate('purchaseDate')}
            autoComplete="off"
          />
        </Field>
        <Field label="數量" required error={errors.quantity}>
          <input
            id="quantity"
            type="number"
            min="1"
            className="input"
            value={form.quantity}
            onChange={(e) => setField('quantity', e.target.value)}
            onBlur={() => handleBlurValidate('quantity')}
          />
        </Field>
      </div>

      {/* Expiry date */}
      <Field
        label="有效日期"
        required
        error={errors.expiryDate}
        helper="記錄在產品包裝上的到期日"
      >
        <input
          id="expiryDate"
          type="date"
          className="input"
          value={form.expiryDate}
          min={form.purchaseDate || today}
          onChange={(e) => setField('expiryDate', e.target.value)}
          onBlur={() => handleBlurValidate('expiryDate')}
          autoComplete="off"
        />
      </Field>

      {/* Unit price + Total price */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="單價（NT$）">
          <input
            id="unitPrice"
            type="number"
            min="0"
            step="1"
            className="input"
            placeholder="例：980"
            value={form.unitPrice}
            onChange={(e) => setField('unitPrice', e.target.value)}
          />
        </Field>
        <Field label="總價（NT$）" helper="輸入單價×數量後自動計算">
          <input
            id="totalPrice"
            type="number"
            min="0"
            step="1"
            className="input"
            placeholder="自動計算"
            value={form.totalPrice}
            onChange={(e) => setField('totalPrice', e.target.value)}
          />
        </Field>
      </div>

      {/* Channel */}
      <Field label="購買通路">
        <select
          id="channel"
          className="input"
          value={form.channel}
          onChange={(e) => setField('channel', e.target.value)}
        >
          <option value="">不指定</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      {/* ── Progressive disclosure: advanced fields ── */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-700
                   cursor-pointer transition-colors py-1"
        aria-expanded={showAdvanced}
        aria-controls="advanced-fields"
      >
        {showAdvanced ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        {showAdvanced ? '收起進階欄位' : '顯示進階欄位（製造日期、開封日、PAO）'}
      </button>

      {showAdvanced && (
        <div id="advanced-fields" className="space-y-4 pt-1 border-t border-surface-border">
          <div className="grid grid-cols-2 gap-3">
            <Field label="製造日期" helper="通常標示 MFD 或 DOM">
              <input
                id="manufactureDate"
                type="date"
                className="input"
                value={form.manufactureDate}
                max={form.expiryDate || today}
                onChange={(e) => setField('manufactureDate', e.target.value)}
              />
            </Field>
            <Field label="開封日期">
              <input
                id="openedDate"
                type="date"
                className="input"
                value={form.openedDate}
                min={form.purchaseDate || ''}
                max={today}
                onChange={(e) => setField('openedDate', e.target.value)}
              />
            </Field>
          </div>

          <Field label="開封後有效期（月）" helper="PAO — Period After Opening，通常標示在瓶蓋符號旁">
            <input
              id="paoMonths"
              type="number"
              min="1"
              max="60"
              className="input w-40"
              placeholder="例：12"
              value={form.paoMonths}
              onChange={(e) => setField('paoMonths', e.target.value)}
            />
          </Field>
        </div>
      )}

      {/* Notes */}
      <Field label="備註">
        <textarea
          id="notes"
          className="input resize-none"
          rows={2}
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
          {mutation.isPending
            ? <LoadingSpinner size="sm" />
            : isEdit ? '儲存變更' : '新增紀錄'}
        </button>
      </div>
    </form>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  helper,
  error,
  children,
}: {
  label:    string
  required?: boolean
  helper?:  string
  error?:   string
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
      {helper && !error && (
        <p className="text-xs text-ink-muted mt-1">{helper}</p>
      )}
      {error && (
        <p role="alert" aria-live="polite" className="text-xs text-status-danger mt-1">
          {error}
        </p>
      )}
    </div>
  )
}
