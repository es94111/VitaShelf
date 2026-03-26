import { useEffect, useState, useRef } from 'react'
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

const APP_VERSION = '2.0.2'

// ─── helpers ─────────────────────────────────────────────────────────────────

type ApiLikeError = { response?: { data?: { message?: string } } }

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

// ─── Admin registration policy section ───────────────────────────────────────

function AdminRegistrationSection() {
  const toast = useToast()
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings().then((r) => r.data),
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

  if (isLoading) {
    return (
      <Section icon={<Shield size={16} aria-hidden="true" />} title="公開註冊設定（管理員）">
        <LoadingSpinner />
      </Section>
    )
  }

  return (
    <Section icon={<Shield size={16} aria-hidden="true" />} title="公開註冊設定（管理員）">
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

const CSV_TEMPLATE_HEADERS = 'name,brand,category,subCategory,spec,barcode,notes'
const CSV_TEMPLATE_EXAMPLE = [
  CSV_TEMPLATE_HEADERS,
  '玫瑰精華液,品牌A,skincare,精華液,30ml,,補水保濕',
  '維他命C,品牌B,supplement,維他命,60錠,4719854321,,',
].join('\n')

function downloadCSVTemplate() {
  const blob = new Blob(['\uFEFF' + CSV_TEMPLATE_EXAMPLE], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'vitashelf-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function ImportSection() {
  const toast       = useToast()
  const queryClient = useQueryClient()
  const fileRef     = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)

  const mutation = useMutation({
    mutationFn: (file: File) => importApi.products(file).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data)
      if (data.imported > 0) {
        queryClient.invalidateQueries({ queryKey: ['products'] })
        toast.success(`成功匯入 ${data.imported} 個產品`)
      } else { toast.error('未匯入任何產品，請檢查格式') }
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '匯入失敗')),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    mutation.mutate(file)
  }

  return (
    <Section icon={<Upload size={16} aria-hidden="true" />} title="資料匯入">
      <p className="text-sm text-ink-muted dark:text-gray-400">透過 CSV 批次匯入產品資料。請先下載範本，依格式填寫後上傳。</p>
      <div className="bg-surface dark:bg-gray-800 rounded-md p-3 text-xs font-mono text-ink-muted dark:text-gray-400 overflow-x-auto">
        {CSV_TEMPLATE_HEADERS}
      </div>
      <p className="text-xs text-ink-muted dark:text-gray-500 -mt-2">
        category 欄位只接受 <code className="font-mono bg-surface dark:bg-gray-800 px-1 rounded">skincare</code> 或{' '}
        <code className="font-mono bg-surface dark:bg-gray-800 px-1 rounded">supplement</code>
      </p>
      <div className="flex flex-wrap gap-3">
        <button className="btn-secondary" onClick={downloadCSVTemplate} type="button">
          <FileText size={15} /> 下載 CSV 範本
        </button>
        <label className="btn btn-primary cursor-pointer">
          {mutation.isPending ? <LoadingSpinner size="sm" /> : <Upload size={15} />}
          {mutation.isPending ? '匯入中…' : '上傳 CSV 匯入'}
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFileChange} disabled={mutation.isPending} />
        </label>
      </div>
      {result && (
        <div className="space-y-2">
          <p className={`text-sm flex items-center gap-1.5 ${result.imported > 0 ? 'text-status-ok' : 'text-status-danger'}`}>
            {result.imported > 0
              ? <><CheckCircle size={14} /> 成功匯入 {result.imported} 個產品</>
              : <><AlertCircle size={14} /> 未能匯入任何產品</>}
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
  return (
    <Section icon={<Info size={16} aria-hidden="true" />} title="關於 VitaShelf">
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-ink-muted dark:text-gray-400">版本</dt>
          <dd className="font-mono text-ink dark:text-gray-200 font-medium">v{APP_VERSION}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-muted dark:text-gray-400">說明</dt>
          <dd className="text-ink dark:text-gray-200">保養品與保健食品庫存管理系統</dd>
        </div>
      </dl>
    </Section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { isAdmin } = useAuth()

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-heading font-semibold text-ink dark:text-gray-100">設定</h1>
        <p className="text-sm text-ink-muted dark:text-gray-400 mt-0.5">管理帳號與應用程式偏好設定</p>
      </div>

      <ProfileSection />
      <PasswordSection />
      {isAdmin && <AdminRegistrationSection />}
      <LoginLogsSection />
      <ExportSection />
      <ImportSection />
      <AboutSection />
    </div>
  )
}
