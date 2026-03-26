import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Package, ShoppingCart, AlertTriangle, TrendingDown,
  Clock, XCircle, BarChart2, ArrowUpCircle, ArrowDownCircle,
  Settings2, Layers,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { dashboardApi, alertsApi } from '@/services/api'
import StatCard from '@/components/ui/StatCard'
import { StatCardSkeleton } from '@/components/ui/Skeleton'
import AlertBadge from '@/components/ui/AlertBadge'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { clsx } from 'clsx'

const PIE_COLORS = ['#2563EB', '#F97316']

// ─── Stock log type helpers ───────────────────────────────────────────────────

const LOG_TYPE_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  IN:          { label: '入庫',   icon: <ArrowUpCircle size={14} />,   color: 'text-status-ok' },
  OUT_USE:     { label: '出庫',   icon: <ArrowDownCircle size={14} />, color: 'text-status-warn' },
  OUT_DISCARD: { label: '報廢',   icon: <XCircle size={14} />,         color: 'text-status-danger' },
  ADJUST:      { label: '盤點',   icon: <Settings2 size={14} />,       color: 'text-primary' },
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats().then((r) => r.data),
  })

  const { data: monthlySpend } = useQuery({
    queryKey: ['dashboard-monthly-spend'],
    queryFn: () => dashboardApi.monthlySpend().then((r) => r.data),
  })

  const { data: brandBreakdown } = useQuery({
    queryKey: ['dashboard-brand-breakdown'],
    queryFn: () => dashboardApi.brandBreakdown().then((r) => r.data),
  })

  const { data: recentActivity } = useQuery({
    queryKey: ['dashboard-recent-activity'],
    queryFn: () => dashboardApi.recentActivity().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: expiring } = useQuery({
    queryKey: ['alerts-expiring'],
    queryFn: () => alertsApi.expiring().then((r) => r.data),
  })

  const categoryData = stats
    ? [
        { name: '保養品',   value: stats.skincareCount },
        { name: '保健食品', value: stats.supplementCount },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-ink">儀表板</h1>
        <p className="text-sm text-ink-muted mt-1">
          {format(new Date(), 'yyyy年 M月 d日 EEEE', { locale: zhTW })}
        </p>
      </div>

      {/* Stat Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="產品總數"         value={stats?.totalProducts    ?? 0} icon={Package}       iconColor="text-primary" />
          <StatCard title="緊急到期"         value={stats?.expiringIn7Days  ?? 0} icon={AlertTriangle}  iconColor="text-status-danger" />
          <StatCard title="即將到期（30天）"  value={stats?.expiringIn30Days ?? 0} icon={Clock}          iconColor="text-status-warn" />
          <StatCard title="低庫存"           value={stats?.lowStockCount    ?? 0} icon={TrendingDown}   iconColor="text-accent" />
          <StatCard title="保養品"           value={stats?.skincareCount    ?? 0} icon={ShoppingCart}   iconColor="text-blue-400" />
          <StatCard title="保健食品"         value={stats?.supplementCount  ?? 0} icon={BarChart2}      iconColor="text-green-500" />
          <StatCard title="已過期"           value={stats?.expiredCount     ?? 0} icon={XCircle}        iconColor="text-status-danger" />
          <StatCard
            title="本月消費"
            value={`NT$ ${(stats?.totalSpentThisMonth ?? 0).toLocaleString()}`}
            icon={ShoppingCart}
            iconColor="text-ink-muted"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Spend Bar Chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink mb-4">每月消費金額</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySpend ?? []} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v: number) => [`NT$ ${v.toLocaleString()}`, '消費']}
                contentStyle={{ borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }}
              />
              <Bar dataKey="amount" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Pie Chart */}
        <div className="card">
          <h2 className="text-sm font-semibold text-ink mb-4">分類分佈</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(v) => <span style={{ fontSize: 12, color: '#1E293B' }}>{v}</span>}
              />
              <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Brand Breakdown + Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Brand Breakdown horizontal bar */}
        <div className="card">
          <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <Layers size={15} aria-hidden="true" /> 品牌分佈（Top 10）
          </h2>
          {brandBreakdown && brandBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(160, brandBreakdown.length * 32)}>
              <BarChart
                data={brandBreakdown}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="brand"
                  tick={{ fontSize: 12, fill: '#1E293B' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  formatter={(v: number) => [v, '產品數']}
                  contentStyle={{ borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#7C3AED" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-ink-muted text-center py-8">尚無產品資料</p>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="card">
          <h2 className="text-sm font-semibold text-ink mb-4">最近庫存異動</h2>
          {recentActivity && recentActivity.length > 0 ? (
            <ul className="space-y-3" aria-label="最近庫存異動">
              {recentActivity.map((log) => {
                const meta = LOG_TYPE_MAP[log.type] ?? { label: log.type, icon: null, color: 'text-ink' }
                return (
                  <li key={log.id} className="flex items-start gap-3">
                    <span className={clsx('mt-0.5 shrink-0', meta.color)} aria-hidden="true">
                      {meta.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">
                        <Link
                          to={`/products/${log.product.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {log.product.name}
                        </Link>
                        <span className="text-ink-muted ml-1">
                          {meta.label} {log.quantity} 個
                        </span>
                      </p>
                      {log.reason && (
                        <p className="text-xs text-ink-muted truncate">{log.reason}</p>
                      )}
                    </div>
                    <time
                      className="text-xs text-ink-faint shrink-0"
                      dateTime={log.createdAt}
                      title={format(parseISO(log.createdAt), 'yyyy/MM/dd HH:mm')}
                    >
                      {formatDistanceToNow(parseISO(log.createdAt), { locale: zhTW, addSuffix: true })}
                    </time>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted text-center py-8">尚無庫存異動紀錄</p>
          )}
        </div>
      </div>

      {/* Expiring Soon */}
      {expiring && expiring.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink">即將到期提醒</h2>
            <Link to="/alerts" className="text-xs text-primary hover:underline">
              查看全部 →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base" aria-label="即將到期產品列表">
              <thead>
                <tr>
                  <th>產品名稱</th>
                  <th>品牌</th>
                  <th>到期日</th>
                  <th>剩餘天數</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                {expiring.slice(0, 10).map(({ product, expiryDate, daysUntilExpiry, alertLevel }) => (
                  <tr key={product.id}>
                    <td>
                      <Link
                        to={`/products/${product.id}`}
                        className="font-medium text-ink hover:text-primary transition-colors"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="text-ink-muted">{product.brand}</td>
                    <td className="text-ink-muted tabular-nums">
                      {format(parseISO(expiryDate), 'yyyy/MM/dd')}
                    </td>
                    <td className="tabular-nums font-medium">
                      {daysUntilExpiry < 0
                        ? `已過期 ${Math.abs(daysUntilExpiry)} 天`
                        : `${daysUntilExpiry} 天`}
                    </td>
                    <td>
                      <AlertBadge level={alertLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
