import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ShoppingCart, Trash2, Edit2 } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { Link } from 'react-router-dom'
import { productsApi, purchasesApi } from '@/services/api'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import PurchaseForm from '@/components/features/PurchaseForm'
import { clsx } from 'clsx'
import type { PurchaseRecord } from '@/types'

// ─── Expiry badge ─────────────────────────────────────────────────────────────

function ExpiryCell({ expiryDate }: { expiryDate: string }) {
  const days = differenceInDays(parseISO(expiryDate), new Date())
  return (
    <div>
      <p className="tabular-nums text-sm">{format(parseISO(expiryDate), 'yyyy/MM/dd')}</p>
      <p className={clsx('text-xs font-medium mt-0.5', {
        'text-status-expired': days < 0,
        'text-status-danger':  days >= 0 && days <= 7,
        'text-status-warn':    days > 7  && days <= 30,
        'text-ink-muted':      days > 30,
      })}>
        {days < 0 ? `已過期 ${Math.abs(days)} 天` : `剩 ${days} 天`}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Purchases() {
  const toast        = useToast()
  const queryClient  = useQueryClient()

  const [search,    setSearch]    = useState('')
  const [productId, setProductId] = useState('')
  const [page,      setPage]      = useState(1)
  const [addOpen,   setAddOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<PurchaseRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRecord | null>(null)

  const debouncedSearch = useDebounce(search, 350)

  // ── Fetch purchases ─────────────────────────────────────────────────────

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['purchases', { productId, page }],
    queryFn:  () =>
      purchasesApi.list(productId || undefined).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  // ── Fetch products for filter dropdown ──────────────────────────────────

  const { data: productsData } = useQuery({
    queryKey: ['products', { pageSize: 200 }],
    queryFn:  () => productsApi.list({ pageSize: 200 }).then((r) => r.data),
  })
  const products = productsData?.data ?? []

  // ── Client-side search filter (on product name) ──────────────────────────

  const filtered = (data?.data ?? []).filter((p) => {
    if (!debouncedSearch) return true
    const q = debouncedSearch.toLowerCase()
    return (
      p.product?.name?.toLowerCase().includes(q) ||
      p.product?.brand?.toLowerCase().includes(q) ||
      p.channel?.toLowerCase().includes(q)
    )
  })

  // ── Delete mutation ─────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchasesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-expiring'] })
      toast.success('購買紀錄已刪除')
      setDeleteTarget(null)
    },
    onError: () => toast.error('刪除失敗，請重試'),
  })

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-ink">購買紀錄</h1>
          <p className="text-sm text-ink-muted mt-0.5">共 {data?.total ?? 0} 筆紀錄</p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          新增紀錄
        </button>
      </div>

      {/* Filters */}
      <div className="card flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            type="search"
            className="input pl-9"
            placeholder="搜尋產品名稱、品牌、通路…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="搜尋購買紀錄"
          />
        </div>
        <select
          className="input sm:w-52"
          value={productId}
          onChange={(e) => { setProductId(e.target.value); setPage(1) }}
          aria-label="篩選產品"
        >
          <option value="">全部產品</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className={clsx('card p-0 overflow-hidden transition-opacity duration-150', isPlaceholderData && 'opacity-60')}>
        {isLoading ? (
          <table className="w-full">
            <tbody>{Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)}</tbody>
          </table>
        ) : !filtered.length ? (
          <EmptyState
            icon={ShoppingCart}
            title={search || productId ? '找不到符合的紀錄' : '尚無購買紀錄'}
            description={search || productId ? '請嘗試其他搜尋條件' : '點擊「新增紀錄」來記錄第一筆購買'}
            action={
              !search && !productId
                ? <button className="btn-primary" onClick={() => setAddOpen(true)}>
                    <Plus size={16} aria-hidden="true" /> 新增紀錄
                  </button>
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base whitespace-nowrap" aria-label="購買紀錄列表">
              <thead>
                <tr>
                  <th>產品</th>
                  <th>購買日期</th>
                  <th>數量</th>
                  <th>總價</th>
                  <th>通路</th>
                  <th>有效日期</th>
                  <th><span className="sr-only">操作</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id}>
                    <td>
                      {record.product ? (
                        <Link
                          to={`/products/${record.productId}`}
                          className="font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {record.product.name}
                        </Link>
                      ) : (
                        <span className="text-ink-muted text-xs">（已刪除）</span>
                      )}
                      {record.product?.brand && (
                        <p className="text-xs text-ink-muted">{record.product.brand}</p>
                      )}
                    </td>
                    <td className="tabular-nums text-ink-muted">
                      {format(parseISO(record.purchaseDate), 'yyyy/MM/dd')}
                    </td>
                    <td className="tabular-nums font-medium">{record.quantity}</td>
                    <td className="tabular-nums">
                      {record.totalPrice
                        ? <span>NT$ {Number(record.totalPrice).toLocaleString()}</span>
                        : <span className="text-ink-faint">—</span>}
                    </td>
                    <td>
                      {record.channel
                        ? <span className="badge badge-info">{record.channel}</span>
                        : <span className="text-ink-faint">—</span>}
                    </td>
                    <td>
                      <ExpiryCell expiryDate={record.expiryDate} />
                    </td>
                    <td>
                      <div className="flex gap-1.5 justify-end">
                        <button
                          className="p-1.5 rounded-md hover:bg-surface text-ink-muted hover:text-primary
                                     transition-colors cursor-pointer"
                          aria-label="編輯此紀錄"
                          onClick={() => setEditTarget(record)}
                        >
                          <Edit2 size={15} aria-hidden="true" />
                        </button>
                        <button
                          className="p-1.5 rounded-md hover:bg-red-50 text-ink-muted hover:text-status-danger
                                     transition-colors cursor-pointer"
                          aria-label="刪除此紀錄"
                          onClick={() => setDeleteTarget(record)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>第 {page} / {data.totalPages} 頁</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一頁</button>
            <button className="btn-secondary" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>下一頁</button>
          </div>
        </div>
      )}

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="新增購買紀錄" size="lg">
        <PurchaseForm
          onSuccess={() => setAddOpen(false)}
          onCancel={() => setAddOpen(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="編輯購買紀錄"
        size="lg"
      >
        {editTarget && (
          <PurchaseForm
            purchase={editTarget}
            onSuccess={() => setEditTarget(null)}
            onCancel={() => setEditTarget(null)}
          />
        )}
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="刪除購買紀錄"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>取消</button>
            <button
              className="btn-danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <LoadingSpinner size="sm" /> : '確認刪除'}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink">
          確定要刪除「<strong>{deleteTarget?.product?.name}</strong>」的這筆購買紀錄嗎？此操作無法復原。
        </p>
        {deleteTarget && (
          <dl className="mt-3 text-sm text-ink-muted space-y-1">
            <div className="flex gap-2">
              <dt>購買日期：</dt>
              <dd className="tabular-nums">{format(parseISO(deleteTarget.purchaseDate), 'yyyy/MM/dd')}</dd>
            </div>
            <div className="flex gap-2">
              <dt>數量：</dt>
              <dd className="tabular-nums">{deleteTarget.quantity}</dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  )
}
