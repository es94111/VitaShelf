import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Bell,
  Tag,
  Settings,
  LogOut,
  Leaf,
  X,
  Sun,
  Moon,
  Shield,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { alertsApi } from '@/services/api'

// ─── Alert count badge ────────────────────────────────────────────────────────

function useAlertCount() {
  const { data: expiring } = useQuery({
    queryKey: ['alerts-expiring'],
    queryFn:  () => alertsApi.expiring().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  })
  const { data: expired } = useQuery({
    queryKey: ['alerts-expired'],
    queryFn:  () => alertsApi.expired().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  })
  return (expiring?.length ?? 0) + (expired?.length ?? 0)
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/',           icon: LayoutDashboard, label: '儀表板',  badge: false },
  { to: '/products',   icon: Package,         label: '產品管理', badge: false },
  { to: '/purchases',  icon: ShoppingCart,    label: '購買紀錄', badge: false },
  { to: '/alerts',     icon: Bell,            label: '到期提醒', badge: true  },
  { to: '/categories', icon: Tag,             label: '分類標籤', badge: false },
  { to: '/settings',   icon: Settings,        label: '設定',    badge: false },
]

// ─── Component ───────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { logout, user, isAdmin } = useAuth()
  const alertCount = useAlertCount()
  const { theme, toggleTheme } = useTheme()

  const navContent = (
    <aside className="flex flex-col w-60 h-full bg-white dark:bg-gray-900 border-r border-surface-border dark:border-gray-700">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-surface-border dark:border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
            <Leaf size={18} className="text-white" aria-hidden="true" />
          </div>
          <span className="font-heading font-semibold text-lg text-ink dark:text-gray-100 tracking-tight">
            VitaShelf
          </span>
        </div>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-md text-ink-muted hover:bg-surface hover:text-ink
                       dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200
                       transition-colors cursor-pointer"
            aria-label="關閉選單"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="主選單">
        {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onMobileClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer',
                isActive
                  ? 'bg-primary/10 text-primary dark:bg-primary/20'
                  : 'text-ink-muted hover:bg-surface hover:text-ink dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
              )
            }
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {badge && alertCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                           rounded-full bg-status-danger text-white text-[11px] font-semibold tabular-nums"
                aria-label={`${alertCount} 個到期提醒`}
              >
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </NavLink>
        ))}

        {/* Admin link — only for ADMIN role */}
        {isAdmin && (
          <NavLink
            to="/admin"
            onClick={onMobileClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer',
                isActive
                  ? 'bg-primary/10 text-primary dark:bg-primary/20'
                  : 'text-ink-muted hover:bg-surface hover:text-ink dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
              )
            }
          >
            <Shield size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="flex-1">管理員</span>
          </NavLink>
        )}
      </nav>

      {/* User + Theme + Logout */}
      <div className="px-3 py-4 border-t border-surface-border dark:border-gray-700 space-y-1">
        {user && (
          <div className="px-3 py-2">
            <p className="text-xs text-ink-muted dark:text-gray-500">登入中</p>
            <p className="text-sm font-medium text-ink dark:text-gray-200 truncate">{user.displayName}</p>
            {isAdmin && (
              <span className="inline-block mt-0.5 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                管理員
              </span>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium
                     text-ink-muted hover:bg-surface hover:text-ink
                     dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200
                     transition-colors duration-150 cursor-pointer"
          aria-label={theme === 'dark' ? '切換至淺色模式' : '切換至深色模式'}
        >
          {theme === 'dark' ? (
            <Sun size={18} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Moon size={18} strokeWidth={1.75} aria-hidden="true" />
          )}
          {theme === 'dark' ? '淺色模式' : '深色模式'}
        </button>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium
                     text-ink-muted hover:bg-red-50 hover:text-status-danger
                     dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400
                     transition-colors duration-150 cursor-pointer"
          aria-label="登出"
        >
          <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
          登出
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop: always visible sidebar */}
      <div className="hidden lg:flex shrink-0 min-h-screen">
        {navContent}
      </div>

      {/* Mobile: slide-in drawer */}
      <div
        className={clsx(
          'lg:hidden fixed inset-y-0 left-0 z-40 w-60 transform transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-modal="true"
        role="dialog"
        aria-label="導覽選單"
      >
        {navContent}
      </div>
    </>
  )
}
