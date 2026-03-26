import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package, RotateCcw, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { productsApi } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import AlertBadge from '@/components/ui/AlertBadge'
import { ProductListSkeleton, TableRowSkeleton } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import ProductForm from '@/components/features/ProductForm'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'active' | 'deleted'

export default function Products() {
  const navigate      = useNavigate()
  const toast         = useToast()
  const queryClient   = useQueryClient()

  const [tab,      setTab]      = useState<Tab>('active')
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('')
  const [page,     setPage]     = useState(1)
  const [addOpen,  setAddOpen]  = useState(false)

  // ── Active products ──────────────────────────────────────────────────────────
  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['products', { search, category, page }],
    queryFn:  () =>
      productsApi
        .list({ search, category: category || undefined, page, pageSize: 20 })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
    enabled: tab === 'active',
  })

  // ── Deleted products ─────────────────────────────────────────────────────────
  const { data: deletedData, isLoading: deletedLoading } = useQuery({
    queryKey: ['products-deleted', { search }],
    queryFn:  () =>
      productsApi
        .list({ search, deleted: 'true', pageSize: 50 })
        .then((r) => r.data),
    enabled: tab === 'deleted',
  })

  // ── Restore mutation ──────────────────────────────────────────────────────────
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const restoreMutation = useMutation({
    mutationFn: (id: string) => productsApi.restore(id),
    onSuccess: (_r, id) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products-deleted'] })
      toast.success('產品已還原')
      setRestoringId(null)
    },
    onError: () => {
      toast.error('還原失敗')
      setRestoringId(null)
    },
  })

  function handleTabChange(t: Tab) {
    setTab(t)
    setPage(1)
    setSearch('')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-ink">產品管理</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            共 {tab === 'active' ? (data?.total ?? 0) : (deletedData?.total ?? 0)} 項{tab === 'deleted' ? '已刪除' : ''}產品
          </p>
        </div>
        {tab === 'active' && (
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            新增產品
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-lg w-fit border border-surface-border">
        <button
          onClick={() => handleTabChange('active')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            tab === 'active'
              ? 'bg-white text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          一般產品
        </button>
        <button
          onClick={() => handleTabChange('deleted')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            tab === 'deleted'
              ? 'bg-white text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Trash2 size={13} className="inline mr-1" aria-hidden="true" />
          已刪除
          {deletedData && deletedData.total > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                             rounded-full bg-ink-muted text-white text-[11px] font-semibold tabular-nums">
              {deletedData.total}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="card flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            className="input pl-9"
            placeholder="搜尋產品名稱、品牌…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            aria-label="搜尋產品"
          />
        </div>
        {tab === 'active' && (
          <select
            className="input sm:w-40"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1) }}
            aria-label="篩選分類"
          >
            <option value="">全部分類</option>
            <option value="skincare">保養品</option>
            <option value="supplement">保健食品</option>
          </select>
        )}
      </div>

      {/* ── Active products table ── */}
      {tab === 'active' && (
        <>
          {isLoading ? (
            <ProductListSkeleton rows={8} />
          ) : !data?.data.length ? (
            <div className="card">
              <EmptyState
                icon={<Package size={40} strokeWidth={1.5} />}
                title="尚無產品"
                description="點擊「新增產品」來新增第一個產品"
                action={
                  <button className="btn-primary" onClick={() => setAddOpen(true)}>
                    <Plus size={16} aria-hidden="true" />
                    新增產品
                  </button>
                }
              />
            </div>
          ) : (
            <div className={`card p-0 overflow-hidden transition-opacity duration-150 ${isPlaceholderData ? 'opacity-60' : ''}`}>
              <div className="overflow-x-auto">
                <table className="table-base" aria-label="產品列表">
                  <thead>
                    <tr>
                      <th>產品名稱</th>
                      <th>品牌</th>
                      <th>分類</th>
                      <th>庫存</th>
                      <th>狀態</th>
                      <th><span className="sr-only">操作</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((product) => (
                      <tr
                        key={product.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/products/${product.id}`)}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-9 h-9 rounded-md object-cover border border-surface-border"
                                loading="lazy"
                                width={36}
                                height={36}
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-surface border border-surface-border
                                              flex items-center justify-center shrink-0">
                                <Package size={16} className="text-ink-faint" aria-hidden="true" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-ink">{product.name}</p>
                              {product.spec && (
                                <p className="text-xs text-ink-muted">{product.spec}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-ink-muted">{product.brand}</td>
                        <td>
                          <span className="badge badge-info">
                            {product.category === 'skincare' ? '保養品' : '保健食品'}
                          </span>
                        </td>
                        <td className="tabular-nums font-medium">{product.currentStock}</td>
                        <td>
                          <AlertBadge level={product.alertLevel} />
                        </td>
                        <td>
                          <button
                            className="btn-secondary text-xs px-2.5 py-1.5"
                            aria-label={`檢視 ${product.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/products/${product.id}`)
                            }}
                          >
                            檢視
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-ink-muted">
              <span>第 {page} / {data.totalPages} 頁</span>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一頁
                </button>
                <button
                  className="btn-secondary"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Deleted products table ── */}
      {tab === 'deleted' && (
        <>
          {deletedLoading ? (
            <div className="card p-0 overflow-hidden">
              <table className="table-base">
                <thead><tr><th>產品名稱</th><th>品牌</th><th>分類</th><th><span className="sr-only">操作</span></th></tr></thead>
                <tbody>{Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)}</tbody>
              </table>
            </div>
          ) : !deletedData?.data.length ? (
            <div className="card">
              <EmptyState
                icon={<Trash2 size={40} strokeWidth={1.5} />}
                title="沒有已刪除的產品"
                description="已刪除的產品會顯示在這裡，可點擊「還原」恢復"
              />
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-base" aria-label="已刪除產品列表">
                  <thead>
                    <tr>
                      <th>產品名稱</th>
                      <th>品牌</th>
                      <th>分類</th>
                      <th><span className="sr-only">操作</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedData.data.map((product) => (
                      <tr key={product.id} className="opacity-70">
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-md bg-surface border border-surface-border
                                            flex items-center justify-center shrink-0">
                              <Package size={16} className="text-ink-faint" aria-hidden="true" />
                            </div>
                            <p className="font-medium text-ink line-through">{product.name}</p>
                          </div>
                        </td>
                        <td className="text-ink-muted">{product.brand}</td>
                        <td>
                          <span className="badge badge-info">
                            {product.category === 'skincare' ? '保養品' : '保健食品'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-secondary text-xs px-2.5 py-1.5"
                            aria-label={`還原 ${product.name}`}
                            disabled={restoringId === product.id}
                            onClick={() => {
                              setRestoringId(product.id)
                              restoreMutation.mutate(product.id)
                            }}
                          >
                            {restoringId === product.id
                              ? <LoadingSpinner size="sm" />
                              : <><RotateCcw size={13} aria-hidden="true" /> 還原</>
                            }
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add product modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="新增產品" size="lg">
        <ProductForm
          onSuccess={() => {
            setAddOpen(false)
            queryClient.invalidateQueries({ queryKey: ['products'] })
          }}
          onCancel={() => setAddOpen(false)}
        />
      </Modal>
    </div>
  )
}
