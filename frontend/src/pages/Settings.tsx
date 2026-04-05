import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  User, Lock, Info,
  Eye, EyeOff, CheckCircle, Clock, History,
} from 'lucide-react'
import { usersApi } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import type { LoginLog } from '@/types'
import { format } from 'date-fns'

// Bump this constant every release — shown when /changelog.json is unavailable
const APP_VERSION = '2.3.0'

const LOCAL_CHANGELOG_URL  = '/changelog.json'
const REMOTE_CHANGELOG_URL = 'https://raw.githubusercontent.com/es94111/VitaShelf/refs/heads/main/changelog.json'

// ─── helpers ─────────────────────────────────────────────────────────────────

type ApiLikeError = { response?: { status?: number; data?: { message?: string } } }

function getApiErrorMessage(err: unknown, fallback: string): string {
  return (err as ApiLikeError).response?.data?.message ?? fallback
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

// ─── About section ────────────────────────────────────────────────────────────

interface ChangelogRelease {
  version: string
  date: string
  type: string
  summary: string
  changes: { category: string; description: string }[]
}

const CATEGORY_LABEL: Record<string, string> = {
  added:    '新增',
  changed:  '調整',
  improved: '改善',
  fixed:    '修復',
  removed:  '移除',
}

const CATEGORY_CLASS: Record<string, string> = {
  added:    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  changed:  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  improved: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  fixed:    'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  removed:  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
}

function AboutSection() {
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [updating, setUpdating] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)

  const localQuery = useQuery({
    queryKey: ['changelog-local'],
    queryFn: async () => {
      const res = await fetch(LOCAL_CHANGELOG_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error('無法讀取版本資訊')
      return res.json() as Promise<{ currentVersion: string; releases: ChangelogRelease[] }>
    },
    staleTime: Infinity,
    retry: false,
  })
  // Always have a version to show: from file → fallback to hardcoded constant
  const currentVersion = localQuery.data?.currentVersion ?? APP_VERSION

  const remoteVersionQuery = useQuery({
    queryKey: ['remote-version'],
    queryFn: async () => {
      const res = await fetch(REMOTE_CHANGELOG_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error('無法取得遠端版本資訊')
      const json = (await res.json()) as { currentVersion?: string }
      if (!json.currentVersion) throw new Error('遠端版本資訊格式不正確')
      return { version: json.currentVersion }
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: false,
  })

  useEffect(() => {
    if (remoteVersionQuery.data || remoteVersionQuery.error) {
      setLastCheckedAt(new Date())
    }
  }, [remoteVersionQuery.data, remoteVersionQuery.error])

  const latestVersion = remoteVersionQuery.data?.version
  const hasNewVersion = !!latestVersion && compareSemver(latestVersion, currentVersion) > 0

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
    <>
    <Section icon={<Info size={16} aria-hidden="true" />} title="關於 VitaShelf">
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-ink-muted dark:text-gray-400">版本</dt>
          <dd className="font-mono text-ink dark:text-gray-200 font-medium">
            {localQuery.isLoading ? '…' : `v${currentVersion}`}
          </dd>
        </div>
        {/* 最新版本 & 更新狀態：remote 失敗時整行不顯示，避免誤導 */}
        {!remoteVersionQuery.isError && (
          <>
            <div className="flex items-center justify-between">
              <dt className="text-ink-muted dark:text-gray-400">最新版本</dt>
              <dd className="font-mono text-ink dark:text-gray-200 font-medium">
                {remoteVersionQuery.isFetching ? '檢查中...' : latestVersion ? `v${latestVersion}` : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-muted dark:text-gray-400">更新狀態</dt>
              <dd className={`font-medium ${hasNewVersion ? 'text-status-warn' : 'text-status-ok'}`}>
                {remoteVersionQuery.isFetching
                  ? '檢查中...'
                  : !latestVersion
                    ? '尚未檢查'
                    : hasNewVersion
                      ? '有新版本可更新'
                      : '目前已是最新版本'}
              </dd>
            </div>
          </>
        )}
        {lastCheckedAt && !remoteVersionQuery.isError && (
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
        <button
          type="button"
          className="text-sm text-primary hover:underline flex items-center gap-1"
          onClick={() => setChangelogOpen(true)}
        >
          <History size={14} aria-hidden="true" />
          查看版本紀錄
        </button>
      </div>
    </Section>

    {/* Changelog modal */}
    <Modal
      open={changelogOpen}
      onClose={() => setChangelogOpen(false)}
      title="版本紀錄"
      size="lg"
    >
      {localQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      ) : localQuery.isError ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-sm text-ink-muted">目前版本：<span className="font-mono font-semibold">v{APP_VERSION}</span></p>
          <p className="text-xs text-ink-faint">詳細版本紀錄在重新部署後可用</p>
        </div>
      ) : (
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {(localQuery.data?.releases ?? []).map((release) => (
            <div key={release.version} className="border border-surface-border dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-surface dark:bg-gray-800">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-ink dark:text-gray-100">
                    v{release.version}
                  </span>
                  {release.version === currentVersion && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      目前版本
                    </span>
                  )}
                </div>
                <span className="text-xs text-ink-muted dark:text-gray-400">{release.date}</span>
              </div>
              {release.changes?.length > 0 && (
                <ul className="divide-y divide-surface-border dark:divide-gray-700">
                  {release.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                      <span className={`shrink-0 mt-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded ${CATEGORY_CLASS[change.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {CATEGORY_LABEL[change.category] ?? change.category}
                      </span>
                      <span className="text-ink dark:text-gray-200">{change.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
    </>
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
      <LoginLogsSection />
      <AboutSection />
    </div>
  )
}
