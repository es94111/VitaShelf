import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Shield, Users, ClipboardList, Settings, RefreshCw,
  Trash2, CheckCircle, XCircle, ChevronDown,
} from 'lucide-react'
import { adminApi } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { format } from 'date-fns'
import type { LoginLog } from '@/types'

type ApiErr = { response?: { data?: { message?: string } } }
function errMsg(err: unknown, fb: string) { return (err as ApiErr).response?.data?.message ?? fb }

// ─── Tab system ──────────────────────────────────────────────────────────────

type Tab = 'settings' | 'users' | 'logs'

const TABS: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: 'settings', label: '註冊政策', icon: Settings },
  { key: 'users',    label: '使用者管理', icon: Users },
  { key: 'logs',     label: '登入紀錄',  icon: ClipboardList },
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

// ─── Admin Page ──────────────────────────────────────────────────────────────

export default function Admin() {
  const [tab, setTab] = useState<Tab>('settings')

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
            onClick={() => setTab(key)}
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
      </div>
    </div>
  )
}
