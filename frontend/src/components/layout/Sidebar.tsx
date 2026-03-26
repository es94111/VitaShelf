import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BellAlert,
  Tag,
  Settings,
  LogOut,
  Leaf,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: '儀表板' },
  { to: '/products',   icon: Package,         label: '產品管理' },
  { to: '/purchases',  icon: ShoppingCart,    label: '購買紀錄' },
  { to: '/alerts',     icon: BellAlert,       label: '到期提醒' },
  { to: '/categories', icon: Tag,             label: '分類標籤' },
  { to: '/settings',   icon: Settings,        label: '設定' },
]

export default function Sidebar() {
  const { logout, user } = useAuth()

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-white border-r border-surface-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-surface-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
          <Leaf size={18} className="text-white" />
        </div>
        <span className="font-heading font-semibold text-lg text-ink tracking-tight">
          VitaShelf
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="主選單">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-ink-muted hover:bg-surface hover:text-ink',
              )
            }
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-surface-border space-y-1">
        {user && (
          <div className="px-3 py-2">
            <p className="text-xs text-ink-muted">登入中</p>
            <p className="text-sm font-medium text-ink truncate">{user.displayName}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-ink-muted hover:bg-red-50 hover:text-status-danger transition-colors duration-150 cursor-pointer"
          aria-label="登出"
        >
          <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
          登出
        </button>
      </div>
    </aside>
  )
}
