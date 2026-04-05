import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { stockApi } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import type { StockLog } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  IN:          '入庫',
  OUT_USE:     '出庫(使用)',
  OUT_DISCARD: '報廢',
  ADJUST:      '盤點',
}

const TYPE_CLASSES: Record<string, string> = {
  IN:          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  OUT_USE:     'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  OUT_DISCARD: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  ADJUST:      'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
}

const PAGE_SIZE = 30

export default function StockLogs() {
  const navigate     = useNavigate()
  const toast        = useToast()
  const queryClient  = useQueryClient()

  const [page,          setPage]          = useState(1)
  const [editOpen,      setEditOpen]      = useState(false)
  const [editingLog,    setEditingLog]    = useState<StockLog | null>(null)
  const [editType,      setEditType]      = useState<'OUT_USE' | 'OUT_DISCARD' | 'ADJUST'>('OUT_USE')
  const [editQty,       setEditQty]       = useState('1')
  const [editReason,    setEditReason]    = useState('')

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['stockLogs-all', page],
    queryFn:  () => stockApi.logs({ page, pageSize: PAGE_SIZE }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const updateMutation = useMutation({
    mutationFn: (d: { logId: string; type: StockLog['type']; quantity: number; reason?: string }) =>
      stockApi.update(d.logId, { type: d.type, quantity: d.quantity, reason: d.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockLogs-all'] })
      toast.success('庫存異動已更新')
      setEditOpen(false)
      setEditingLog(null)
    },
    onError: () => toast.error('更新失敗'),
  })

  const deleteMutation = useMutation({
    mutationFn: (logId: string) => stockApi.delete(logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockLogs-all'] })
      toast.success('庫存異動已刪除')
    },
    onError: () => toast.error('刪除失敗'),
  })

  function openEdit(log: StockLog) {
    setEditingLog(log)
    setEditType(log.type as 'OUT_USE' | 'OUT_DISCARD' | 'ADJUST')
    setEditQty(log.quantity.toString())
    setEditReason(log.reason || '')
    setEditOpen(true)
  }

  function handleUpdate() {
    if (!editingLog || !editQty || Number(editQty) <= 0) {
      toast.error('請輸入有效的數量')
      return
    }
    updateMutation.mutate({
      logId: editingLog.id,
      type: editType,
      quantity: Number(editQty),
      reason: editReason || undefined,
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-ink">庫存歷史異動紀錄</h1>
        <p className="text-sm text-ink-muted mt-0.5">共 {data?.total ?? 0} 筆異動紀錄</p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card p-0 overflow-hidden">
          <table className="table-base text-sm">
            <thead>
              <tr>
                <th>日期</th>
                <th>產品名稱</th>
                <th>類型</th>
                <th>數量</th>
                <th>原因</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={6} />
              ))}
            </tbody>
          </table>
        </div>
      ) : !data?.data.length ? (
        <div className="card">
          <EmptyState
            icon={Activity}
            title="尚無庫存異動紀錄"
            description="在產品詳細頁面操作庫存後，異動紀錄將顯示於此"
          />
        </div>
      ) : (
        <div className={clsx('card p-0 overflow-hidden transition-opacity duration-150', isPlaceholderData && 'opacity-60')}>
          <div className="overflow-x-auto">
            <table className="table-base text-sm" aria-label="庫存異動紀錄">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>產品名稱</th>
                  <th>類型</th>
                  <th>數量</th>
                  <th>原因</th>
                  <th className="text-right"><span className="sr-only">操作</span></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log: StockLog) => (
                  <tr key={log.id}>
                    <td className="text-ink-muted tabular-nums whitespace-nowrap">
                      {format(parseISO(log.createdAt), 'yyyy/MM/dd HH:mm')}
                    </td>
                    <td>
                      {log.product ? (
                        <button
                          className="text-primary hover:underline font-medium"
                          onClick={() => navigate(`/products/${log.product!.id}`)}
                        >
                          {log.product.name}
                        </button>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={clsx('text-xs font-medium px-2 py-1 rounded', TYPE_CLASSES[log.type])}>
                        {TYPE_LABELS[log.type] ?? log.type}
                      </span>
                    </td>
                    <td className="tabular-nums font-medium">{log.quantity}</td>
                    <td className="text-ink-muted">{log.reason || '—'}</td>
                    <td className="text-right">
                      <button
                        className="text-primary hover:underline text-xs mr-3"
                        onClick={() => openEdit(log)}
                      >
                        編輯
                      </button>
                      <button
                        className="text-status-danger hover:underline text-xs"
                        onClick={() => {
                          if (confirm('確定要刪除此異動記錄嗎？')) {
                            deleteMutation.mutate(log.id)
                          }
                        }}
                      >
                        刪除
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

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditingLog(null) }}
        title="編輯庫存異動"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setEditOpen(false); setEditingLog(null) }}>取消</button>
            <button
              className="btn-primary"
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !editQty || Number(editQty) <= 0}
            >
              {updateMutation.isPending ? <LoadingSpinner size="sm" /> : '保存'}
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
                value={editType}
                onChange={(e) => setEditType(e.target.value as typeof editType)}
              >
                <option value="OUT_USE">出庫（使用）</option>
                <option value="OUT_DISCARD">出庫（報廢）</option>
                <option value="ADJUST">盤點（設定絕對值）</option>
              </select>
            </div>
            <div>
              <label htmlFor="editQty" className="block text-sm font-medium text-ink mb-1">
                數量 <span className="text-status-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="editQty"
                type="number"
                min="1"
                className="input"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="editReason" className="block text-sm font-medium text-ink mb-1">原因（選填）</label>
              <input
                id="editReason"
                className="input"
                placeholder="例：已開封使用"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
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
