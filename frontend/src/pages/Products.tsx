import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { productsApi } from '@/services/api'
import AlertBadge from '@/components/ui/AlertBadge'
import { ProductListSkeleton } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import ProductForm from '@/components/features/ProductForm'

export default function Products() {
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('')
  const [page,     setPage]     = useState(1)
  const [addOpen,  setAddOpen]  = useState(false)

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['products', { search, category, page }],
    queryFn:  () =>
      productsApi
        .list({ search, category: category || undefined, page, pageSize: 20 })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-ink">產品管理</h1>
          <p className="text-sm text-ink-muted mt-0.5">共 {data?.total ?? 0} 項產品</p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          新增產品
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
      </div>

      {/* Table */}
      {isLoading ? (
        <ProductListSkeleton rows={8} />
      ) : !data?.data.length ? (
        <div className="card">
          <EmptyState
            icon={Package}
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
                      onClick={(e) => { e.stopPropagation(); navigate(`/products/${product.id}`) }}
                    >
                      檢視
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
