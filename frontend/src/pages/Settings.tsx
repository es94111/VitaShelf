import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  User, Lock, Download, Upload, Info,
  Eye, EyeOff, CheckCircle, FileText, AlertCircle, Clock, Shield,
} from 'lucide-react'
import { usersApi, exportApi, importApi, adminApi } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { LoginLog } from '@/types'
import { format } from 'date-fns'

const APP_VERSION = '2.2.4'
const REMOTE_CHANGELOG_BLOB_URL = 'https://github.com/es94111/VitaShelf/blob/main/changelog.json'

// ─── helpers ─────────────────────────────────────────────────────────────────

type ApiLikeError = { response?: { status?: number; data?: { message?: string } } }

function getApiErrorMessage(err: unknown, fallback: string): string {
  return (err as ApiLikeError).response?.data?.message ?? fallback
}

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

function toRawGitHubUrl(url: string): string {
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/)
  if (!m) return url
  const [, owner, repo, branch, filePath] = m
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
}

function compareSemver(a: string, b: string): number {
  const av = a.split('.').map((x) => parseInt(x, 10) || 0)
  const bv = b.split('.').map((x) => parseInt(x, 10) || 0)
  const len = Math.max(av.length, bv.length)
  for (let i = 0; i < len; i++) {
    const ai = av[i] ?? 0
    const bi = bv[i] ?? 0
    if (ai > bi) return 1
    if (ai < bi) return -1
  }
  return 0
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card dark:bg-gray-900 dark:border-gray-700 space-y-4">
      <h2 className="text-sm font-semibold text-ink dark:text-gray-100 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  )
}

// ─── Profile section ──────────────────────────────────────────────────────────

function ProfileSection() {
  const { user, updateUser } = useAuth()
  const toast            = useToast()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [nameError, setNameError]   = useState('')
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: () => usersApi.updateMe({ displayName: displayName.trim() }),
    onSuccess: (res) => {
      // Update auth context — sidebar will reflect change immediately
      updateUser({ displayName: res.data.displayName })
      toast.success('個人資料已更新')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err: unknown) =>
      toast.error(getApiErrorMessage(err, '更新失敗')),
  })

  function validate() {
    if (!displayName.trim()) { setNameError('顯示名稱不得為空'); return false }
    setNameError('')
    return true
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    mutation.mutate()
  }

  return (
    <Section icon={<User size={16} aria-hidden="true" />} title="個人資料">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
              顯示名稱 <span className="text-status-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="displayName"
              className="input dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={validate}
              aria-describedby={nameError ? 'displayName-error' : undefined}
              aria-invalid={!!nameError}
            />
            {nameError && (
              <p id="displayName-error" className="text-xs text-status-danger mt-1" role="alert">{nameError}</p>
            )}
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">電子郵件</label>
            <input
              id="email"
              type="email"
              className="input opacity-60 cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400"
              value={user?.email ?? ''}
              readOnly
              disabled
            />
            <p className="text-xs text-ink-muted dark:text-gray-500 mt-1">電子郵件無法變更</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <LoadingSpinner size="sm" /> : '儲存變更'}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-status-ok">
              <CheckCircle size={14} aria-hidden="true" /> 已儲存
            </span>
          )}
        </div>
      </form>
    </Section>
  )
}

// ─── Password section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const toast = useToast()
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: () => usersApi.changePassword({ currentPassword: currentPwd, newPassword: newPwd }),
    onSuccess: () => {
      toast.success('密碼已更新')
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '密碼更新失敗')),
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!currentPwd) e.currentPwd = '請輸入目前密碼'
    if (newPwd.length < 8) e.newPwd = '新密碼至少 8 個字元'
    if (newPwd !== confirmPwd) e.confirmPwd = '兩次輸入的密碼不一致'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    mutation.mutate()
  }

  return (
    <Section icon={<Lock size={16} aria-hidden="true" />} title="修改密碼">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="currentPwd" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
            目前密碼 <span className="text-status-danger" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <input
              id="currentPwd"
              type={showCurrent ? 'text' : 'password'}
              className="input pr-10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer transition-colors"
              onClick={() => setShowCurrent((v) => !v)}
              aria-label={showCurrent ? '隱藏密碼' : '顯示密碼'}
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.currentPwd && <p className="text-xs text-status-danger mt-1" role="alert">{errors.currentPwd}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="newPwd" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
              新密碼 <span className="text-status-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="newPwd"
                type={showNew ? 'text' : 'password'}
                className="input pr-10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer transition-colors"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? '隱藏密碼' : '顯示密碼'}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.newPwd && <p className="text-xs text-status-danger mt-1" role="alert">{errors.newPwd}</p>}
          </div>
          <div>
            <label htmlFor="confirmPwd" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
              確認新密碼 <span className="text-status-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="confirmPwd"
              type="password"
              className="input dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              autoComplete="new-password"
            />
            {errors.confirmPwd && <p className="text-xs text-status-danger mt-1" role="alert">{errors.confirmPwd}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <LoadingSpinner size="sm" /> : '更新密碼'}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-status-ok">
              <CheckCircle size={14} /> 已更新
            </span>
          )}
        </div>
      </form>
    </Section>
  )
}

// ─── Login logs section ──────────────────────────────────────────────────────

function LoginLogsSection() {
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['my-login-logs'],
    queryFn: () => usersApi.myLoginLogs({ pageSize: 10 }).then((r) => r.data),
    staleTime: 1000 * 60 * 2,
  })

  function handleSync() {
    refetch()
    setLastSync(new Date())
  }

  return (
    <Section icon={<Clock size={16} aria-hidden="true" />} title="登入紀錄">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-ink-muted dark:text-gray-400">最近 10 次登入紀錄</p>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-xs text-ink-faint dark:text-gray-500">
              上次同步 {format(lastSync, 'HH:mm:ss')}
            </span>
          )}
          <button
            onClick={handleSync}
            className="btn-secondary text-xs px-2 py-1"
            disabled={isLoading}
          >
            {isLoading ? <LoadingSpinner size="sm" /> : '同步'}
          </button>
        </div>
      </div>
      {data?.data && data.data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="table-base dark:text-gray-300">
            <thead>
              <tr className="dark:bg-gray-800 dark:border-gray-700">
                <th className="dark:text-gray-400">時間</th>
                <th className="dark:text-gray-400">IP</th>
                <th className="dark:text-gray-400">國家</th>
                <th className="dark:text-gray-400">方式</th>
                <th className="dark:text-gray-400">狀態</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((log: LoginLog) => (
                <tr key={log.id || log.createdAt} className="dark:border-gray-700 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap dark:border-gray-700">{format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                  <td className="font-mono text-xs dark:border-gray-700">{log.ip}</td>
                  <td className="dark:border-gray-700">{log.country || '-'}</td>
                  <td className="dark:border-gray-700">{log.method}</td>
                  <td className="dark:border-gray-700">
                    <span className={log.success ? 'badge-ok' : 'badge-danger'}>
                      {log.success ? '成功' : '失敗'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-ink-muted dark:text-gray-500">尚無登入紀錄</p>
      )}
    </Section>
  )
}

// ─── Admin submenu section ───────────────────────────────────────────────────

type AdminSubTab = 'registration' | 'users' | 'logs'

function AdminSubmenuSection() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<AdminSubTab>('registration')

  const { data: settings, isLoading, isError, error } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings().then((r) => r.data),
    enabled: isAdmin,
  })

  const [open, setOpen] = useState(true)
  const [notice, setNotice] = useState('')

  // Keep local form state in sync with server values.
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
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '更新失敗')),
  })

  if (!isAdmin) return null

  if (isLoading) {
    return (
      <Section icon={<Shield size={16} aria-hidden="true" />} title="公開註冊設定（管理員）">
        <LoadingSpinner />
      </Section>
    )
  }

  if (isError) {
    const status = (error as ApiLikeError).response?.status
    if (status === 403) {
      return (
        <Section icon={<Shield size={16} aria-hidden="true" />} title="管理員子選單">
          <p className="text-sm text-ink-muted dark:text-gray-400">
            目前帳號尚未通過管理員權限驗證，請重新登入後再試。
          </p>
        </Section>
      )
    }

    return (
      <Section icon={<Shield size={16} aria-hidden="true" />} title="公開註冊設定（管理員）">
        <p className="text-sm text-status-danger">目前無法載入公開註冊設定，請稍後再試。</p>
      </Section>
    )
  }

  return (
    <Section icon={<Shield size={16} aria-hidden="true" />} title="管理員子選單">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('registration')}
          className={`px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
            tab === 'registration'
              ? 'bg-primary/10 text-primary dark:bg-primary/20'
              : 'bg-surface text-ink-muted dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          註冊政策
        </button>
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
            tab === 'users'
              ? 'bg-primary/10 text-primary dark:bg-primary/20'
              : 'bg-surface text-ink-muted dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          使用者管理
        </button>
        <button
          type="button"
          onClick={() => setTab('logs')}
          className={`px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
            tab === 'logs'
              ? 'bg-primary/10 text-primary dark:bg-primary/20'
              : 'bg-surface text-ink-muted dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          登入紀錄
        </button>
      </div>

      {tab === 'registration' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-ink dark:text-gray-200">開放公開註冊</label>
            <button
              type="button"
              role="switch"
              aria-checked={open}
              onClick={() => setOpen((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                open ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  open ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-ink-muted dark:text-gray-400">
              {open ? '允許新使用者註冊' : '已關閉註冊'}
            </span>
          </div>

          <div>
            <label htmlFor="admin-registration-notice" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
              關閉註冊提示訊息
            </label>
            <textarea
              id="admin-registration-notice"
              className="input dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 min-h-[80px]"
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              placeholder="例如：系統維護中，暫停註冊"
            />
          </div>

          <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <LoadingSpinner size="sm" /> : '儲存'}
          </button>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted dark:text-gray-400">管理使用者角色與帳號狀態。</p>
          <Link to="/admin?tab=users" className="btn-primary inline-flex">前往使用者管理</Link>
        </div>
      )}

      {tab === 'logs' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted dark:text-gray-400">查看與管理全站登入紀錄。</p>
          <Link to="/admin?tab=logs" className="btn-primary inline-flex">前往登入紀錄</Link>
        </div>
      )}
    </Section>
  )
}

// ─── Export section ───────────────────────────────────────────────────────────

function ExportSection() {
  const toast = useToast()
  const [exportingProducts, setExportingProducts] = useState(false)
  const [exportingPurchases, setExportingPurchases] = useState(false)

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

  return (
    <Section icon={<Download size={16} aria-hidden="true" />} title="資料匯出">
      <p className="text-sm text-ink-muted dark:text-gray-400">以 CSV 格式匯出資料，可用 Excel 或 Numbers 開啟。</p>
      <div className="flex flex-wrap gap-3">
        <button className="btn-secondary" onClick={handleExportProducts} disabled={exportingProducts}>
          {exportingProducts ? <LoadingSpinner size="sm" /> : <Download size={15} />} 匯出產品清單
        </button>
        <button className="btn-secondary" onClick={handleExportPurchases} disabled={exportingPurchases}>
          {exportingPurchases ? <LoadingSpinner size="sm" /> : <Download size={15} />} 匯出購買紀錄
        </button>
      </div>
    </Section>
  )
}

// ─── Import section ───────────────────────────────────────────────────────────

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

function ImportSection() {
  const toast       = useToast()
  const queryClient = useQueryClient()
  const productFileRef  = useRef<HTMLInputElement>(null)
  const purchaseFileRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<{ type: 'products' | 'purchases'; imported: number; errors: string[] } | null>(null)

  const productMutation = useMutation({
    mutationFn: (file: File) => importApi.products(file).then((r) => r.data),
    onSuccess: (data) => {
      setResult({ type: 'products', ...data })
      if (data.imported > 0) {
        queryClient.invalidateQueries({ queryKey: ['products'] })
        toast.success(`成功匯入 ${data.imported} 個產品`)
      } else { toast.error('未匯入任何產品，請檢查格式') }
      if (productFileRef.current) productFileRef.current.value = ''
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '匯入失敗')),
  })

  const purchaseMutation = useMutation({
    mutationFn: (file: File) => importApi.purchases(file).then((r) => r.data),
    onSuccess: (data) => {
      setResult({ type: 'purchases', ...data })
      if (data.imported > 0) {
        queryClient.invalidateQueries({ queryKey: ['purchases'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        toast.success(`成功匯入 ${data.imported} 筆購買紀錄`)
      } else { toast.error('未匯入任何購買紀錄，請檢查格式') }
      if (purchaseFileRef.current) purchaseFileRef.current.value = ''
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '匯入失敗')),
  })

  function handleProductsFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    productMutation.mutate(file)
  }

  function handlePurchasesFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    purchaseMutation.mutate(file)
  }

  return (
    <Section icon={<Upload size={16} aria-hidden="true" />} title="資料匯入">
      <p className="text-sm text-ink-muted dark:text-gray-400">透過 CSV 批次匯入產品或購買紀錄。請先下載對應範本，依格式填寫後上傳。</p>

      <div className="space-y-4">
        <div className="rounded-md border border-border dark:border-gray-700 p-3 space-y-2">
          <h3 className="text-sm font-medium text-ink dark:text-gray-200">產品匯入</h3>
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
              <input ref={productFileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleProductsFileChange} disabled={productMutation.isPending} />
            </label>
          </div>
        </div>

        <div className="rounded-md border border-border dark:border-gray-700 p-3 space-y-2">
          <h3 className="text-sm font-medium text-ink dark:text-gray-200">購買紀錄匯入</h3>
          <div className="bg-surface dark:bg-gray-800 rounded-md p-3 text-xs font-mono text-ink-muted dark:text-gray-400 overflow-x-auto">
            {PURCHASE_CSV_TEMPLATE_HEADERS}
          </div>
          <p className="text-xs text-ink-muted dark:text-gray-500">
            <strong>productId</strong> 可從產品詳情頁網址中取得，或留空由系統根據 <strong>productName</strong> 與 <strong>productBrand</strong> 自動匹配。日期建議使用 <span className="font-mono">YYYY-MM-DD</span> 格式；支援跨帳戶匯入。
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" onClick={() => downloadCSVTemplate(PURCHASE_CSV_TEMPLATE_EXAMPLE, 'vitashelf-purchases-import-template.csv')} type="button">
              <FileText size={15} /> 下載購買紀錄範本
            </button>
            <label className="btn btn-primary cursor-pointer">
              {purchaseMutation.isPending ? <LoadingSpinner size="sm" /> : <Upload size={15} />}
              {purchaseMutation.isPending ? '匯入中…' : '上傳購買紀錄 CSV'}
              <input ref={purchaseFileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handlePurchasesFileChange} disabled={purchaseMutation.isPending} />
            </label>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-2">
          <p className={`text-sm flex items-center gap-1.5 ${result.imported > 0 ? 'text-status-ok' : 'text-status-danger'}`}>
            {result.imported > 0
              ? <>
                <CheckCircle size={14} />
                成功匯入 {result.imported} {result.type === 'products' ? '個產品' : '筆購買紀錄'}
              </>
              : <>
                <AlertCircle size={14} />
                未能匯入任何{result.type === 'products' ? '產品' : '購買紀錄'}
              </>}
          </p>
          {result.errors.length > 0 && (
            <ul className="text-xs text-status-danger space-y-0.5 max-h-32 overflow-y-auto bg-red-50 dark:bg-red-900/20 rounded p-2">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </Section>
  )
}

// ─── About section ────────────────────────────────────────────────────────────

function AboutSection() {
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [updating, setUpdating] = useState(false)

  const remoteVersionQuery = useQuery({
    queryKey: ['remote-version', REMOTE_CHANGELOG_BLOB_URL],
    queryFn: async () => {
      const rawUrl = toRawGitHubUrl(REMOTE_CHANGELOG_BLOB_URL)
      const res = await fetch(rawUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error('無法取得遠端版本資訊')

      const json = (await res.json()) as { currentVersion?: string }
      if (!json.currentVersion) throw new Error('遠端版本資訊格式不正確')

      return { version: json.currentVersion }
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (remoteVersionQuery.data || remoteVersionQuery.error) {
      setLastCheckedAt(new Date())
    }
  }, [remoteVersionQuery.data, remoteVersionQuery.error])

  const latestVersion = remoteVersionQuery.data?.version ?? '-'
  const versionCmp = latestVersion === '-' ? 0 : compareSemver(latestVersion, APP_VERSION)
  const hasNewVersion = versionCmp > 0

  async function checkNow() {
    await remoteVersionQuery.refetch()
    setLastCheckedAt(new Date())
  }

  async function runUpdate() {
    setUpdating(true)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }

      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((reg) => reg.unregister()))
      }
    } finally {
      window.location.href = `${window.location.pathname}?updated=${Date.now()}`
    }
  }

  return (
    <Section icon={<Info size={16} aria-hidden="true" />} title="關於 VitaShelf">
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-ink-muted dark:text-gray-400">版本</dt>
          <dd className="font-mono text-ink dark:text-gray-200 font-medium">v{APP_VERSION}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-muted dark:text-gray-400">最新版本</dt>
          <dd className="font-mono text-ink dark:text-gray-200 font-medium">
            {remoteVersionQuery.isLoading ? '檢查中...' : `v${latestVersion}`}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-muted dark:text-gray-400">更新狀態</dt>
          <dd className={`font-medium ${hasNewVersion ? 'text-status-warn' : 'text-status-ok'}`}>
            {remoteVersionQuery.isError
              ? '無法取得更新資訊'
              : hasNewVersion
                ? '有新版本可更新'
                : '目前已是最新版本'}
          </dd>
        </div>
        {lastCheckedAt && (
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted dark:text-gray-400">上次檢查</dt>
            <dd className="text-ink dark:text-gray-200">{format(lastCheckedAt, 'yyyy-MM-dd HH:mm:ss')}</dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt className="text-ink-muted dark:text-gray-400">說明</dt>
          <dd className="text-ink dark:text-gray-200">保養品與保健食品庫存管理系統</dd>
        </div>
      </dl>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => { void checkNow() }}
          disabled={remoteVersionQuery.isFetching}
        >
          {remoteVersionQuery.isFetching ? <LoadingSpinner size="sm" /> : '立即檢查更新'}
        </button>
        {hasNewVersion && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => { void runUpdate() }}
            disabled={updating}
          >
            {updating ? <LoadingSpinner size="sm" /> : '立即更新'}
          </button>
        )}
        <a
          href={REMOTE_CHANGELOG_BLOB_URL}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary hover:underline"
        >
          查看版本紀錄
        </a>
      </div>
    </Section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-heading font-semibold text-ink dark:text-gray-100">設定</h1>
        <p className="text-sm text-ink-muted dark:text-gray-400 mt-0.5">管理帳號與應用程式偏好設定</p>
      </div>

      <ProfileSection />
      <PasswordSection />
      <AdminSubmenuSection />
      <LoginLogsSection />
      <ExportSection />
      <ImportSection />
      <AboutSection />
    </div>
  )
}
