import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Package, Edit2, Trash2,
  ShoppingCart, Activity, Plus,
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { productsApi, stockApi } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import AlertBadge from '@/components/ui/AlertBadge'
import Modal from '@/components/ui/Modal'
import ProductForm from '@/components/features/ProductForm'
import PurchaseForm from '@/components/features/PurchaseForm'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { clsx } from 'clsx'
import type { PurchaseRecord, StockLog } from '@/types'

export default function ProductDetail() {
  const { id }       = useParams<{ id: string }>()
  const navigate     = useNavigate()
  const toast        = useToast()
  const queryClient  = useQueryClient()

  const [editOpen,       setEditOpen]       = useState(false)
  const [deleteOpen,     setDeleteOpen]     = useState(false)
  const [stockOpen,      setStockOpen]      = useState(false)
  const [purchaseOpen,   setPurchaseOpen]   = useState(false)
  const [stockEditOpen,  setStockEditOpen]  = useState(false)
  const [editingLog,     setEditingLog]     = useState<StockLog | null>(null)
  const [stockType,      setStockType]      = useState<'OUT_USE' | 'OUT_DISCARD' | 'ADJUST'>('OUT_USE')
  const [stockQty,       setStockQty]       = useState('1')
  const [stockReason,    setStockReason]    = useState('')

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn:  () => productsApi.get(id!).then((r) => r.data),
    enabled:  !!id,
  })

  const { data: stockInfo } = useQuery({
    queryKey: ['stock', id],
    queryFn:  () => stockApi.getByProduct(id!).then((r) => r.data),
    enabled:  !!id,
  })

  const { data: stockLogs } = useQuery({
    queryKey: ['stockLogs', id],
    queryFn:  () => stockApi.logs(id!).then((r) => r.data),
    enabled:  !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => productsApi.delete(id!),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('產品已刪除')
      navigate('/products')
    },
    onError: () => toast.error('刪除失敗'),
  })

  const stockMutation = useMutation({
    mutationFn: () =>
      stockApi.adjust({ productId: id!, type: stockType, quantity: Number(stockQty), reason: stockReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock', id] })
      queryClient.invalidateQueries({ queryKey: ['product', id] })
      queryClient.invalidateQueries({ queryKey: ['stockLogs', id] })
      toast.success('庫存已更新')
      setStockOpen(false)
      setStockQty('1')
      setStockReason('')
    },
    onError: () => toast.error('庫存更新失敗'),
  })

  const stockUpdateMutation = useMutation({
    mutationFn: (data: { logId: string; type: StockLog['type']; quantity: number; reason?: string }) =>
      stockApi.update(data.logId, { type: data.type, quantity: data.quantity, reason: data.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockLogs', id] })
      queryClient.invalidateQueries({ queryKey: ['stock', id] })
      toast.success('庫存異動已更新')
      setStockEditOpen(false)
      setEditingLog(null)
    },
    onError: () => toast.error('更新失敗'),
  })

  const stockDeleteMutation = useMutation({
    mutationFn: (logId: string) => stockApi.delete(logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockLogs', id] })
      queryClient.invalidateQueries({ queryKey: ['stock', id] })
      toast.success('庫存異動已刪除')
    },
    onError: () => toast.error('刪除失敗'),
  })

  const openEditLog = (log: StockLog) => {
    setEditingLog(log)
    setStockType(log.type as 'OUT_USE' | 'OUT_DISCARD' | 'ADJUST')
    setStockQty(log.quantity.toString())
    setStockReason(log.reason || '')
    setStockEditOpen(true)
  }

  const handleUpdateLog = () => {
    if (editingLog && !stockQty || Number(stockQty) <= 0) {
      toast.error('請輸入有效的數量')
      return
    }
    stockUpdateMutation.mutate({
      logId: editingLog!.id,
      type: stockType,
      quantity: Number(stockQty),
      reason: stockReason || undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-24">
        <p className="text-ink-muted">找不到此產品</p>
        <Link to="/products" className="text-primary text-sm hover:underline mt-2 inline-block">
          返回列表
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-md hover:bg-surface text-ink-muted hover:text-ink transition-colors cursor-pointer"
          aria-label="返回上一頁"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-heading font-semibold text-ink truncate">{product.name}</h1>
          <p className="text-sm text-ink-muted">{product.brand}</p>
        </div>
        <AlertBadge level={product.alertLevel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: Product info ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Product card */}
          <div className="card">
            <div className="flex gap-4">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-24 h-24 rounded-lg object-cover border border-surface-border shrink-0"
                  width={96} height={96}
                  loading="lazy"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-surface-border
                                flex items-center justify-center bg-surface shrink-0">
                  <Package size={32} className="text-ink-faint" aria-hidden="true" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <InfoRow label="分類"   value={product.category === 'skincare' ? '保養品' : '保健食品'} />
                  <InfoRow label="子分類" value={product.subCategory} />
                  <InfoRow label="規格"   value={product.spec} />
                  <InfoRow label="條碼"   value={product.barcode} mono />
                  {product.tags.length > 0 && (
                    <div className="col-span-2">
                      <dt className="text-ink-muted">標籤</dt>
                      <dd className="flex flex-wrap gap-1 mt-1">
                        {product.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-0.5 rounded-full text-xs text-white"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {product.notes && (
              <div className="mt-4 pt-4 border-t border-surface-border">
                <p className="text-xs text-ink-muted mb-1">備註</p>
                <p className="text-sm text-ink whitespace-pre-wrap">{product.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-surface-border">
              <button className="btn-secondary text-sm" onClick={() => setEditOpen(true)}>
                <Edit2 size={15} aria-hidden="true" /> 編輯
              </button>
              <button
                className="btn-danger text-sm ml-auto"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 size={15} aria-hidden="true" /> 刪除
              </button>
            </div>
          </div>

          {/* Purchase history */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                <ShoppingCart size={16} aria-hidden="true" /> 購買紀錄
              </h2>
            </div>
            {product.purchases?.length ? (
              <table className="table-base" aria-label="購買紀錄">
                <thead>
                  <tr>
                    <th>購買日期</th>
                    <th>數量</th>
                    <th>總價</th>
                    <th>有效日期</th>
                    <th>到期狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {product.purchases.map((p: PurchaseRecord) => {
                    const days = differenceInDays(new Date(p.expiryDate), new Date())
                    return (
                      <tr key={p.id}>
                        <td className="tabular-nums text-ink-muted">
                          {format(parseISO(p.purchaseDate), 'yyyy/MM/dd')}
                        </td>
                        <td className="tabular-nums font-medium">{p.quantity}</td>
                        <td className="tabular-nums">
                          {p.totalPrice ? `NT$ ${Number(p.totalPrice).toLocaleString()}` : '—'}
                        </td>
                        <td className="tabular-nums text-ink-muted">
                          {format(parseISO(p.expiryDate), 'yyyy/MM/dd')}
                        </td>
                        <td>
                          <span className={clsx('text-xs font-medium', {
                            'text-status-danger':  days < 0,
                            'text-status-danger opacity-80': days >= 0 && days <= 7,
                            'text-status-warn':    days > 7 && days <= 30,
                            'text-status-ok':      days > 30,
                          })}>
                            {days < 0 ? `已過期 ${Math.abs(days)} 天` : `剩 ${days} 天`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-ink-muted text-center py-8">尚無購買紀錄</p>
            )}
          </div>

          {/* Stock logs history */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                <Activity size={16} aria-hidden="true" /> 庫存異動紀錄
              </h2>
            </div>
            {stockLogs?.data?.length ? (
              <table className="table-base text-sm" aria-label="庫存異動紀錄">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>類型</th>
                    <th>數量</th>
                    <th>原因</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {stockLogs.data.map((log: StockLog) => (
                    <tr key={log.id}>
                      <td className="text-ink-muted">
                        {format(parseISO(log.createdAt), 'yyyy/MM/dd HH:mm')}
                      </td>
                      <td>
                        <span className={clsx('text-xs font-medium px-2 py-1 rounded', {
                          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300': log.type === 'IN',
                          'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300': log.type === 'OUT_USE',
                          'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300': log.type === 'OUT_DISCARD',
                          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300': log.type === 'ADJUST',
                        })}>
                          {log.type === 'IN' ? '入庫' : log.type === 'OUT_USE' ? '出庫(使用)' : log.type === 'OUT_DISCARD' ? '報廢' : '盤點'}
                        </span>
                      </td>
                      <td className="tabular-nums font-medium">{log.quantity}</td>
                      <td className="text-ink-muted">{log.reason || '—'}</td>
                      <td className="text-right">
                        <button
                          className="text-primary hover:underline text-xs mr-2"
                          onClick={() => openEditLog(log)}
                          title="編輯"
                        >
                          編輯
                        </button>
                        <button
                          className="text-status-danger hover:underline text-xs"
                          onClick={() => {
                            if (confirm('確定要刪除此異動記錄嗎？')) {
                              stockDeleteMutation.mutate(log.id)
                            }
                          }}
                          title="刪除"
                        >
                          刪除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-ink-muted text-center py-8">尚無庫存異動</p>
            )}
          </div>
        </div>

        {/* ── Right: Stock panel ── */}
        <div className="space-y-5">
          <div className="card">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
              <Activity size={16} aria-hidden="true" /> 庫存狀況
            </h2>
            <div className="space-y-3">
              <StockRow label="目前庫存" value={stockInfo?.currentStock ?? 0} bold />
              <StockRow label="已使用"   value={stockInfo?.openedCount ?? 0} />
              <StockRow label="已報廢"   value={stockInfo?.discardedCount ?? 0} />
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <button className="btn-primary w-full" onClick={() => setPurchaseOpen(true)}>
                <ShoppingCart size={16} aria-hidden="true" /> 新增購買紀錄
              </button>
              <button className="btn-accent w-full" onClick={() => setStockOpen(true)}>
                <Plus size={16} aria-hidden="true" /> 庫存異動
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add purchase modal ── */}
      <Modal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} title="新增購買紀錄" size="lg">
        <PurchaseForm
          preselectedProductId={id}
          onSuccess={() => {
            setPurchaseOpen(false)
            queryClient.invalidateQueries({ queryKey: ['product', id] })
            queryClient.invalidateQueries({ queryKey: ['stock', id] })
          }}
          onCancel={() => setPurchaseOpen(false)}
        />
      </Modal>

      {/* ── Edit modal ── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="編輯產品" size="lg">
        <ProductForm
          product={product}
          onSuccess={() => {
            setEditOpen(false)
            queryClient.invalidateQueries({ queryKey: ['product', id] })
          }}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      {/* ── Delete confirm modal ── */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="刪除產品"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteOpen(false)}>取消</button>
            <button
              className="btn-danger"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <LoadingSpinner size="sm" /> : '確認刪除'}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink">
          確定要刪除「<strong>{product.name}</strong>」嗎？此操作可在「已刪除」清單中復原。
        </p>
      </Modal>

      {/* ── Stock adjust modal ── */}
      <Modal
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        title="庫存異動"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setStockOpen(false)}>取消</button>
            <button
              className="btn-primary"
              onClick={() => stockMutation.mutate()}
              disabled={stockMutation.isPending || !stockQty || Number(stockQty) <= 0}
            >
              {stockMutation.isPending ? <LoadingSpinner size="sm" /> : '確認'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">異動類型</label>
            <select
              className="input"
              value={stockType}
              onChange={(e) => setStockType(e.target.value as typeof stockType)}
            >
              <option value="OUT_USE">出庫（使用）</option>
              <option value="OUT_DISCARD">出庫（報廢）</option>
              <option value="ADJUST">盤點（設定絕對值）</option>
            </select>
          </div>
          <div>
            <label htmlFor="stockQty" className="block text-sm font-medium text-ink mb-1">
              數量 <span className="text-status-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="stockQty"
              type="number"
              min="1"
              className="input"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="stockReason" className="block text-sm font-medium text-ink mb-1">原因（選填）</label>
            <input
              id="stockReason"
              className="input"
              placeholder="例：已開封使用"
              value={stockReason}
              onChange={(e) => setStockReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── Stock edit modal ── */}
      <Modal
        open={stockEditOpen}
        onClose={() => {
          setStockEditOpen(false)
          setEditingLog(null)
        }}
        title="編輯庫存異動"
        size="sm"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                setStockEditOpen(false)
                setEditingLog(null)
              }}
            >
              取消
            </button>
            <button
              className="btn-primary"
              onClick={handleUpdateLog}
              disabled={stockUpdateMutation.isPending || !stockQty || Number(stockQty) <= 0}
            >
              {stockUpdateMutation.isPending ? <LoadingSpinner size="sm" /> : '保存'}
            </button>
          </>
        }
      >
        {editingLog && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">異動類型</label>
              <select
                className="input"
                value={stockType}
                onChange={(e) => setStockType(e.target.value as typeof stockType)}
              >
                <option value="OUT_USE">出庫（使用）</option>
                <option value="OUT_DISCARD">出庫（報廢）</option>
                <option value="ADJUST">盤點（設定絕對值）</option>
              </select>
            </div>
            <div>
              <label htmlFor="editStockQty" className="block text-sm font-medium text-ink mb-1">
                數量 <span className="text-status-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="editStockQty"
                type="number"
                min="1"
                className="input"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="editStockReason" className="block text-sm font-medium text-ink mb-1">原因（選填）</label>
              <input
                id="editStockReason"
                className="input"
                placeholder="例：已開封使用"
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
              />
            </div>
            <div className="text-xs text-ink-muted pt-2 border-t border-surface-border">
              建立時間：{format(parseISO(editingLog.createdAt), 'yyyy/MM/dd HH:mm:ss')}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={clsx('text-ink font-medium', mono && 'font-mono text-xs')}>{value}</dd>
    </>
  )
}

function StockRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={clsx('tabular-nums text-sm', bold ? 'text-2xl font-heading font-semibold text-ink' : 'text-ink')}>
        {value}
      </span>
    </div>
  )
}
