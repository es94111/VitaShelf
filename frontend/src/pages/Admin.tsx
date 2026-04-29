import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Shield, Users, ClipboardList, Settings, RefreshCw,
  Trash2, CheckCircle, XCircle, ChevronDown,
  Download, Upload, FileText, AlertCircle, Database,
} from 'lucide-react'
import { adminApi, exportApi, importApi } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { format } from 'date-fns'
import type { LoginLog } from '@/types'

type ApiErr = { response?: { data?: { message?: string } } }

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function errMsg(err: unknown, fb: string) { return (err as ApiErr).response?.data?.message ?? fb }

// ─── Tab system ──────────────────────────────────────────────────────────────

type Tab = 'settings' | 'users' | 'logs' | 'data'

function parseTab(tab: string | null): Tab {
  if (tab === 'users') return 'users'
  if (tab === 'logs') return 'logs'
  if (tab === 'data') return 'data'
  return 'settings'
}

const TABS: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: 'settings', label: '註冊政策',   icon: Settings },
  { key: 'users',    label: '使用者管理', icon: Users },
  { key: 'logs',     label: '登入紀錄',   icon: ClipboardList },
  { key: 'data',     label: '資料管理',   icon: Database },
]

// ─── Registration Settings ───────────────────────────────────────────────────

function RegistrationSettings() {
  const toast = useToast()
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings().then(r => r.data),
  })

  const [open, setOpen] = useState(settings?.registrationOpen ?? true)
  const [notice, setNotice] = useState(settings?.registrationNotice ?? '')

  useEffect(() => {
    if (!settings) return
    setOpen(settings.registrationOpen)
    setNotice(settings.registrationNotice ?? '')
  }, [settings])

  const mutation = useMutation({
    mutationFn: () => adminApi.updateSettings({ registrationOpen: open, registrationNotice: notice }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      toast.success('註冊政策已更新')
    },
    onError: (e: unknown) => toast.error(errMsg(e, '更新失敗')),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-ink dark:text-gray-200">開放註冊</label>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          onClick={() => setOpen(v => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            open ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            open ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <span className="text-sm text-ink-muted dark:text-gray-400">{open ? '允許新使用者註冊' : '已關閉註冊'}</span>
      </div>

      <div>
        <label htmlFor="notice" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
          關閉註冊提示訊息
        </label>
        <textarea
          id="notice"
          className="input dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 min-h-[80px]"
          value={notice}
          onChange={e => setNotice(e.target.value)}
          placeholder="例如：系統維護中，暫停註冊"
        />
      </div>

      <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? <LoadingSpinner size="sm" /> : '儲存'}
      </button>
    </div>
  )
}

// ─── User Management ─────────────────────────────────────────────────────────

function UserManagement() {
  const { user: me } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers().then(r => r.data),
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.updateUserRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('角色已更新')
    },
    onError: (e: unknown) => toast.error(errMsg(e, '更新失敗')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('使用者已刪除')
    },
    onError: (e: unknown) => toast.error(errMsg(e, '刪除失敗')),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="overflow-x-auto">
      <table className="table-base dark:text-gray-300">
        <thead>
          <tr className="dark:bg-gray-800 dark:border-gray-700">
            <th className="dark:text-gray-400">名稱</th>
            <th className="dark:text-gray-400">Email</th>
            <th className="dark:text-gray-400">角色</th>
            <th className="dark:text-gray-400">登入方式</th>
            <th className="dark:text-gray-400">建立時間</th>
            <th className="dark:text-gray-400">操作</th>
          </tr>
        </thead>
        <tbody>
          {users?.map(u => (
            <tr key={u.id} className="dark:border-gray-700 dark:hover:bg-gray-800">
              <td className="dark:border-gray-700 font-medium">{u.displayName}</td>
              <td className="dark:border-gray-700 text-sm">{u.email}</td>
              <td className="dark:border-gray-700">
                <div className="relative inline-block">
                  <select
                    value={u.role}
                    onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}
                    disabled={u.id === me?.id}
                    className="input text-xs py-1 px-2 pr-6 appearance-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <option value="ADMIN">管理員</option>
                    <option value="USER">使用者</option>
                    <option value="VIEWER">唯讀</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted" />
                </div>
              </td>
              <td className="dark:border-gray-700 text-xs">{u.authProvider === 'GOOGLE' ? 'Google' : '密碼'}</td>
              <td className="dark:border-gray-700 text-xs whitespace-nowrap">{format(new Date(u.createdAt), 'yyyy-MM-dd')}</td>
              <td className="dark:border-gray-700">
                {u.id !== me?.id && (
                  <button
                    onClick={() => { if (confirm(`確定要刪除 ${u.displayName}？`)) deleteMutation.mutate(u.id) }}
                    className="text-status-danger hover:text-red-700 dark:hover:text-red-400 cursor-pointer p-1"
                    aria-label={`刪除 ${u.displayName}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Login Logs ──────────────────────────────────────────────────────────────

function LoginLogs() {
  const toast = useToast()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-login-logs', page],
    queryFn: () => adminApi.loginLogs({ page, pageSize: 20 }).then(r => r.data),
    staleTime: 1000 * 60,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteLoginLog(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-login-logs'] })
      toast.success('紀錄已刪除')
    },
    onError: (e: unknown) => toast.error(errMsg(e, '刪除失敗')),
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => adminApi.batchDeleteLoginLogs(ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-login-logs'] })
      setSelected(new Set())
      toast.success(res.data.message)
    },
    onError: (e: unknown) => toast.error(errMsg(e, '批次刪除失敗')),
  })

  function handleSync() {
    refetch()
    setLastSync(new Date())
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (!data?.data) return
    const ids = data.data.map((l: LoginLog) => l.id || l.createdAt)
    if (selected.size === ids.length) setSelected(new Set())
    else setSelected(new Set(ids))
  }

  function handleBatchDelete() {
    const ids = Array.from(selected).filter(Boolean)
    if (ids.length === 0) return
    if (!confirm(`確定要刪除 ${ids.length} 筆紀錄？`)) return
    batchDeleteMutation.mutate(ids)
  }

  const logs = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleBatchDelete}
              disabled={batchDeleteMutation.isPending}
              className="btn-danger text-xs px-3 py-1.5"
            >
              {batchDeleteMutation.isPending ? <LoadingSpinner size="sm" /> : <Trash2 size={14} />}
              刪除 {selected.size} 筆
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-xs text-ink-faint dark:text-gray-500">
              上次同步 {format(lastSync, 'HH:mm:ss')}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={isLoading}
            className="btn-secondary text-xs px-2 py-1"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> 同步
          </button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="overflow-x-auto">
          <table className="table-base dark:text-gray-300">
            <thead>
              <tr className="dark:bg-gray-800 dark:border-gray-700">
                <th className="w-8 dark:text-gray-400">
                  <input type="checkbox" checked={logs.length > 0 && selected.size === logs.length} onChange={toggleAll} className="cursor-pointer" />
                </th>
                <th className="dark:text-gray-400">時間</th>
                <th className="dark:text-gray-400">使用者</th>
                <th className="dark:text-gray-400">Email</th>
                <th className="dark:text-gray-400">IP</th>
                <th className="dark:text-gray-400">國家</th>
                <th className="dark:text-gray-400">方式</th>
                <th className="dark:text-gray-400">狀態</th>
                <th className="dark:text-gray-400">原因</th>
                <th className="dark:text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: LoginLog & { user?: { displayName: string } }) => {
                const rowId = log.id || log.createdAt
                return (
                  <tr key={rowId} className="dark:border-gray-700 dark:hover:bg-gray-800">
                    <td className="dark:border-gray-700">
                      <input type="checkbox" checked={selected.has(rowId)} onChange={() => toggleSelect(rowId)} className="cursor-pointer" />
                    </td>
                    <td className="whitespace-nowrap text-xs dark:border-gray-700">{format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                    <td className="dark:border-gray-700 text-sm">{log.user?.displayName ?? '-'}</td>
                    <td className="dark:border-gray-700 text-xs">{log.email}</td>
                    <td className="dark:border-gray-700 font-mono text-xs">{log.ip}</td>
                    <td className="dark:border-gray-700">{log.country || '-'}</td>
                    <td className="dark:border-gray-700 text-xs">{log.method}</td>
                    <td className="dark:border-gray-700">
                      {log.success
                        ? <span className="inline-flex items-center gap-1 text-status-ok text-xs"><CheckCircle size={12} /> 成功</span>
                        : <span className="inline-flex items-center gap-1 text-status-danger text-xs"><XCircle size={12} /> 失敗</span>}
                    </td>
                    <td className="dark:border-gray-700 text-xs text-ink-muted dark:text-gray-500">{log.reason || '-'}</td>
                    <td className="dark:border-gray-700">
                      <button
                        onClick={() => { if (confirm('刪除此筆紀錄？')) deleteMutation.mutate(rowId) }}
                        className="text-status-danger hover:text-red-700 dark:hover:text-red-400 cursor-pointer p-1"
                        aria-label="刪除紀錄"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs px-3 py-1">上一頁</button>
          <span className="text-sm text-ink-muted dark:text-gray-400">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs px-3 py-1">下一頁</button>
        </div>
      )}
    </div>
  )
}

// ─── Data Management ─────────────────────────────────────────────────────────

const PRODUCT_CSV_TEMPLATE_HEADERS = 'name,brand,category,subCategory,spec,barcode,notes'
const PRODUCT_CSV_TEMPLATE_EXAMPLE = [
  PRODUCT_CSV_TEMPLATE_HEADERS,
  '玫瑰精華液,品牌A,skincare,精華液,30ml,,補水保濕',
  '維他命C,品牌B,supplement,維他命,60錠,4719854321,,',
].join('\n')

const PURCHASE_CSV_TEMPLATE_HEADERS = 'productId,productName,productBrand,purchaseDate,quantity,expiryDate,unitPrice,totalPrice,channel,manufactureDate,openedDate,paoMonths,notes'
const PURCHASE_CSV_TEMPLATE_EXAMPLE = [
  PURCHASE_CSV_TEMPLATE_HEADERS,
  'cm1ab2cd30001xyz12345,玫瑰精華液,品牌A,2026-03-26,2,2027-03-26,650,1300,官網,2026-01-10,2026-03-27,12,批次匯入範例',
].join('\n')

function downloadCSVTemplate(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function DataManagement() {
  const toast       = useToast()
  const qc          = useQueryClient()
  const productFileRef  = useRef<HTMLInputElement>(null)
  const purchaseFileRef = useRef<HTMLInputElement>(null)
  const [exportingProducts,  setExportingProducts]  = useState(false)
  const [exportingPurchases, setExportingPurchases] = useState(false)
  const [exportingAll,       setExportingAll]       = useState(false)
  const [result, setResult] = useState<{ type: 'products' | 'purchases'; imported: number; errors: string[] } | null>(null)

  async function handleExportProducts() {
    setExportingProducts(true)
    try {
      const res = await exportApi.products()
      downloadBlob(res.data as Blob, `vitashelf-products-${todayStr()}.csv`)
      toast.success('產品清單已匯出')
    } catch { toast.error('匯出失敗') }
    finally { setExportingProducts(false) }
  }

  async function handleExportPurchases() {
    setExportingPurchases(true)
    try {
      const res = await exportApi.purchases()
      downloadBlob(res.data as Blob, `vitashelf-purchases-${todayStr()}.csv`)
      toast.success('購買紀錄已匯出')
    } catch { toast.error('匯出失敗') }
    finally { setExportingPurchases(false) }
  }

  async function handleExportAll() {
    setExportingAll(true)
    try {
      const res = await exportApi.all()
      downloadBlob(res.data as Blob, `vitashelf-backup-${todayStr().replace(/-/g, '')}.zip`)
      toast.success('完整備份已匯出')
    } catch { toast.error('匯出失敗') }
    finally { setExportingAll(false) }
  }

  const productMutation = useMutation({
    mutationFn: (file: File) => importApi.products(file).then((r) => r.data),
    onSuccess: (data) => {
      setResult({ type: 'products', ...data })
      if (data.imported > 0) {
        qc.invalidateQueries({ queryKey: ['products'] })
        toast.success(`成功匯入 ${data.imported} 個產品`)
      } else { toast.error('未匯入任何產品，請檢查格式') }
      if (productFileRef.current) productFileRef.current.value = ''
    },
    onError: (e: unknown) => toast.error(errMsg(e, '匯入失敗')),
  })

  const purchaseMutation = useMutation({
    mutationFn: (file: File) => importApi.purchases(file).then((r) => r.data),
    onSuccess: (data) => {
      setResult({ type: 'purchases', ...data })
      if (data.imported > 0) {
        qc.invalidateQueries({ queryKey: ['purchases'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
        toast.success(`成功匯入 ${data.imported} 筆購買紀錄`)
      } else { toast.error('未匯入任何購買紀錄，請檢查格式') }
      if (purchaseFileRef.current) purchaseFileRef.current.value = ''
    },
    onError: (e: unknown) => toast.error(errMsg(e, '匯入失敗')),
  })

  return (
    <div className="space-y-6">
      {/* Export */}
      <div>
        <h3 className="text-sm font-semibold text-ink dark:text-gray-200 flex items-center gap-2 mb-3">
          <Download size={15} /> 資料匯出
        </h3>
        <p className="text-sm text-ink-muted dark:text-gray-400 mb-3">以 CSV 格式匯出資料，可用 Excel 或 Numbers 開啟；或選擇「完整備份」一次打包所有資料與圖片。</p>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={handleExportAll} disabled={exportingAll}>
            {exportingAll ? <LoadingSpinner size="sm" /> : <Database size={15} />} 匯出完整備份（含圖片）
          </button>
          <button className="btn-secondary" onClick={handleExportProducts} disabled={exportingProducts}>
            {exportingProducts ? <LoadingSpinner size="sm" /> : <Download size={15} />} 匯出產品清單
          </button>
          <button className="btn-secondary" onClick={handleExportPurchases} disabled={exportingPurchases}>
            {exportingPurchases ? <LoadingSpinner size="sm" /> : <Download size={15} />} 匯出購買紀錄
          </button>
        </div>
      </div>

      <div className="border-t border-surface-border dark:border-gray-700" />

      {/* Import */}
      <div>
        <h3 className="text-sm font-semibold text-ink dark:text-gray-200 flex items-center gap-2 mb-3">
          <Upload size={15} /> 資料匯入
        </h3>
        <p className="text-sm text-ink-muted dark:text-gray-400 mb-4">透過 CSV 批次匯入產品或購買紀錄。請先下載對應範本，依格式填寫後上傳。</p>

        <div className="space-y-4">
          <div className="rounded-md border border-surface-border dark:border-gray-700 p-3 space-y-2">
            <h4 className="text-sm font-medium text-ink dark:text-gray-200">產品匯入</h4>
            <div className="bg-surface dark:bg-gray-800 rounded-md p-3 text-xs font-mono text-ink-muted dark:text-gray-400 overflow-x-auto">
              {PRODUCT_CSV_TEMPLATE_HEADERS}
            </div>
            <p className="text-xs text-ink-muted dark:text-gray-500">
              category 欄位只接受 <code className="font-mono bg-surface dark:bg-gray-800 px-1 rounded">skincare</code> 或{' '}
              <code className="font-mono bg-surface dark:bg-gray-800 px-1 rounded">supplement</code>
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="btn-secondary" onClick={() => downloadCSVTemplate(PRODUCT_CSV_TEMPLATE_EXAMPLE, 'vitashelf-products-import-template.csv')} type="button">
                <FileText size={15} /> 下載產品範本
              </button>
              <label className="btn btn-primary cursor-pointer">
                {productMutation.isPending ? <LoadingSpinner size="sm" /> : <Upload size={15} />}
                {productMutation.isPending ? '匯入中…' : '上傳產品 CSV'}
                <input ref={productFileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setResult(null); productMutation.mutate(f) } }} disabled={productMutation.isPending} />
              </label>
            </div>
          </div>

          <div className="rounded-md border border-surface-border dark:border-gray-700 p-3 space-y-2">
            <h4 className="text-sm font-medium text-ink dark:text-gray-200">購買紀錄匯入</h4>
            <div className="bg-surface dark:bg-gray-800 rounded-md p-3 text-xs font-mono text-ink-muted dark:text-gray-400 overflow-x-auto">
              {PURCHASE_CSV_TEMPLATE_HEADERS}
            </div>
            <p className="text-xs text-ink-muted dark:text-gray-500">
              <strong>productId</strong> 可從產品詳情頁網址取得，或留空由系統根據 <strong>productName</strong> 與 <strong>productBrand</strong> 自動匹配。日期建議使用 <span className="font-mono">YYYY-MM-DD</span> 格式；支援跨帳戶匯入。
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="btn-secondary" onClick={() => downloadCSVTemplate(PURCHASE_CSV_TEMPLATE_EXAMPLE, 'vitashelf-purchases-import-template.csv')} type="button">
                <FileText size={15} /> 下載購買紀錄範本
              </button>
              <label className="btn btn-primary cursor-pointer">
                {purchaseMutation.isPending ? <LoadingSpinner size="sm" /> : <Upload size={15} />}
                {purchaseMutation.isPending ? '匯入中…' : '上傳購買紀錄 CSV'}
                <input ref={purchaseFileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setResult(null); purchaseMutation.mutate(f) } }} disabled={purchaseMutation.isPending} />
              </label>
            </div>
          </div>
        </div>

        {result && (
          <div className="space-y-2 mt-4">
            <p className={`text-sm flex items-center gap-1.5 ${result.imported > 0 ? 'text-status-ok' : 'text-status-danger'}`}>
              {result.imported > 0
                ? <><CheckCircle size={14} /> 成功匯入 {result.imported} {result.type === 'products' ? '個產品' : '筆購買紀錄'}</>
                : <><AlertCircle size={14} /> 未能匯入任何{result.type === 'products' ? '產品' : '購買紀錄'}</>}
            </p>
            {result.errors.length > 0 && (
              <ul className="text-xs text-status-danger space-y-0.5 max-h-32 overflow-y-auto bg-red-50 dark:bg-red-900/20 rounded p-2">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Admin Page ──────────────────────────────────────────────────────────────

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get('tab')))

  useEffect(() => {
    setTab(parseTab(searchParams.get('tab')))
  }, [searchParams])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-heading font-semibold text-ink dark:text-gray-100 flex items-center gap-2">
          <Shield size={22} /> 管理員
        </h1>
        <p className="text-sm text-ink-muted dark:text-gray-400 mt-0.5">管理使用者、註冊政策與登入紀錄</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface dark:bg-gray-800 rounded-lg p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key)
              setSearchParams(key === 'settings' ? {} : { tab: key })
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              tab === key
                ? 'bg-white dark:bg-gray-700 text-ink dark:text-gray-100 shadow-sm'
                : 'text-ink-muted dark:text-gray-400 hover:text-ink dark:hover:text-gray-200'
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card dark:bg-gray-900 dark:border-gray-700">
        {tab === 'settings' && <RegistrationSettings />}
        {tab === 'users' && <UserManagement />}
        {tab === 'logs' && <LoginLogs />}
        {tab === 'data' && <DataManagement />}
      </div>
    </div>
  )
}
