import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Plus, Edit2, Trash2, Palette } from 'lucide-react'
import { tagsApi, type TagWithCount } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'

// ─── Preset colour palette ────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#2563EB', // blue (primary)
  '#7C3AED', // violet
  '#DB2777', // pink
  '#DC2626', // red
  '#EA580C', // orange
  '#D97706', // amber
  '#16A34A', // green
  '#0891B2', // cyan
  '#64748B', // slate (default)
  '#1E293B', // ink
]

// ─── Tag form modal ───────────────────────────────────────────────────────────

interface TagFormProps {
  initial?: TagWithCount
  onSuccess: () => void
  onCancel: () => void
}

function TagForm({ initial, onSuccess, onCancel }: TagFormProps) {
  const [name,  setName]  = useState(initial?.name  ?? '')
  const [color, setColor] = useState(initial?.color ?? '#2563EB')
  const [nameError, setNameError] = useState('')
  const toast        = useToast()
  const queryClient  = useQueryClient()

  const createMutation = useMutation({
    mutationFn: () => tagsApi.create({ name: name.trim(), color }),
    onSuccess: (res) => {
      queryClient.setQueryData<TagWithCount[]>(['tags'], (old = []) => [...old, res.data])
      toast.success('標籤已新增')
      onSuccess()
    },
    onError: () => toast.error('新增失敗'),
  })

  const updateMutation = useMutation({
    mutationFn: () => tagsApi.update(initial!.id, { name: name.trim(), color }),
    onSuccess: (res) => {
      queryClient.setQueryData<TagWithCount[]>(['tags'], (old = []) =>
        old.map((t) => (t.id === initial!.id ? res.data : t)),
      )
      toast.success('標籤已更新')
      onSuccess()
    },
    onError: () => toast.error('更新失敗'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  function validate() {
    if (!name.trim()) { setNameError('請輸入標籤名稱'); return false }
    setNameError('')
    return true
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    if (initial) {
      updateMutation.mutate()
      return
    }
    createMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Preview */}
      <div className="flex items-center gap-3 p-3 bg-surface rounded-lg">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: color }}
        >
          <Tag size={13} aria-hidden="true" />
          {name.trim() || '標籤預覽'}
        </span>
        <span className="text-xs text-ink-muted">預覽效果</span>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="tagName" className="block text-sm font-medium text-ink mb-1">
          標籤名稱 <span className="text-status-danger" aria-hidden="true">*</span>
        </label>
        <input
          id="tagName"
          className="input"
          placeholder="例：有機、效期在即、敏感肌"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={validate}
          maxLength={20}
          aria-describedby={nameError ? 'tagName-error' : undefined}
          aria-invalid={!!nameError}
        />
        {nameError && (
          <p id="tagName-error" className="text-xs text-status-danger mt-1" role="alert">
            {nameError}
          </p>
        )}
      </div>

      {/* Color presets */}
      <div>
        <label className="block text-sm font-medium text-ink mb-2">
          <Palette size={14} className="inline mr-1" aria-hidden="true" />
          標籤顏色
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#1E293B' : 'transparent',
                outline: color === c ? '2px solid white' : 'none',
                outlineOffset: '-4px',
              }}
              aria-label={`選擇顏色 ${c}`}
              aria-pressed={color === c}
            />
          ))}
        </div>
        {/* Custom hex */}
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="w-8 h-8 rounded border border-surface-border cursor-pointer"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="自訂顏色"
          />
          <input
            type="text"
            className="input w-32 font-mono text-sm"
            value={color}
            onChange={(e) => {
              const v = e.target.value
              if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor(v)
            }}
            maxLength={7}
            aria-label="Hex 色碼"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isPending}>
          取消
        </button>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? <LoadingSpinner size="sm" /> : initial ? '儲存變更' : '新增標籤'}
        </button>
      </div>
    </form>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Categories() {
  const toast        = useToast()
  const queryClient  = useQueryClient()

  const [formOpen,    setFormOpen]    = useState(false)
  const [editTarget,  setEditTarget]  = useState<TagWithCount | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<TagWithCount | undefined>()

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn:  () => tagsApi.list().then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: () => tagsApi.delete(deleteTarget!.id),
    onSuccess: () => {
      queryClient.setQueryData<TagWithCount[]>(['tags'], (old = []) =>
        old.filter((t) => t.id !== deleteTarget!.id),
      )
      toast.success('標籤已刪除')
      setDeleteTarget(undefined)
    },
    onError: () => toast.error('刪除失敗'),
  })

  function openCreate() {
    setEditTarget(undefined)
    setFormOpen(true)
  }

  function openEdit(tag: TagWithCount) {
    setEditTarget(tag)
    setFormOpen(true)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-semibold text-ink">分類標籤</h1>
          <p className="text-sm text-ink-muted mt-0.5">管理產品標籤，方便篩選與分類</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} aria-hidden="true" /> 新增標籤
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : tags.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="尚無標籤"
          description="建立第一個標籤，開始為產品分類吧"
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} aria-hidden="true" /> 新增標籤
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tags.map((tag) => (
            <TagCard
              key={tag.id}
              tag={tag}
              onEdit={() => openEdit(tag)}
              onDelete={() => setDeleteTarget(tag)}
            />
          ))}
        </div>
      )}

      {/* ── Create / Edit modal ── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? '編輯標籤' : '新增標籤'}
        size="sm"
      >
        <TagForm
          initial={editTarget}
          onSuccess={() => setFormOpen(false)}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      {/* ── Delete confirm modal ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        title="刪除標籤"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteTarget(undefined)}>
              取消
            </button>
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
          確定要刪除標籤「
          <strong style={{ color: deleteTarget?.color }}>{deleteTarget?.name}</strong>
          」嗎？已套用此標籤的產品將自動移除關聯。
        </p>
        {deleteTarget && deleteTarget.productCount > 0 && (
          <p className="text-sm text-status-warn mt-2">
            目前有 {deleteTarget.productCount} 個產品使用此標籤。
          </p>
        )}
      </Modal>
    </div>
  )
}

// ─── Tag card ─────────────────────────────────────────────────────────────────

interface TagCardProps {
  tag: TagWithCount
  onEdit: () => void
  onDelete: () => void
}

function TagCard({ tag, onEdit, onDelete }: TagCardProps) {
  return (
    <div className="card flex items-start justify-between gap-3 group">
      <div className="flex items-center gap-3 min-w-0">
        {/* Color swatch */}
        <div
          className="w-10 h-10 rounded-lg shrink-0"
          style={{ backgroundColor: tag.color }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{tag.name}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {tag.productCount} 個產品
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100
                      focus-within:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md text-ink-muted hover:bg-surface hover:text-primary
                     transition-colors cursor-pointer"
          aria-label={`編輯標籤 ${tag.name}`}
        >
          <Edit2 size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-ink-muted hover:bg-red-50 hover:text-status-danger
                     transition-colors cursor-pointer"
          aria-label={`刪除標籤 ${tag.name}`}
        >
          <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
