import { useQuery } from '@tanstack/react-query'
import {
  Package, ShoppingCart, AlertTriangle, TrendingDown,
  Clock, XCircle, BarChart2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { dashboardApi, alertsApi } from '@/services/api'
import StatCard from '@/components/ui/StatCard'
import AlertBadge from '@/components/ui/AlertBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'

const PIE_COLORS = ['#2563EB', '#F97316']

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats().then((r) => r.data),
  })

  const { data: monthlySpend } = useQuery({
    queryKey: ['dashboard-monthly-spend'],
    queryFn: () => dashboardApi.monthlySpend().then((r) => r.data),
  })

  const { data: expiring } = useQuery({
    queryKey: ['alerts-expiring'],
    queryFn: () => alertsApi.expiring().then((r) => r.data),
  })

  if (statsLoading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const categoryData = stats
    ? [
        { name: '保養品', value: stats.skincareCount },
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="產品總數"       value={stats?.totalProducts   ?? 0} icon={Package}       iconColor="text-primary" />
        <StatCard title="緊急到期"       value={stats?.expiringIn7Days ?? 0} icon={AlertTriangle}  iconColor="text-status-danger" />
        <StatCard title="即將到期（30天）" value={stats?.expiringIn30Days ?? 0} icon={Clock}        iconColor="text-status-warn" />
        <StatCard title="低庫存"         value={stats?.lowStockCount   ?? 0} icon={TrendingDown}   iconColor="text-accent" />
        <StatCard title="保養品"         value={stats?.skincareCount   ?? 0} icon={ShoppingCart}   iconColor="text-blue-400" />
        <StatCard title="保健食品"       value={stats?.supplementCount ?? 0} icon={BarChart2}      iconColor="text-green-500" />
        <StatCard title="已過期"         value={stats?.expiredCount    ?? 0} icon={XCircle}        iconColor="text-status-expired" />
        <StatCard
          title="本月消費"
          value={`NT$ ${(stats?.totalSpentThisMonth ?? 0).toLocaleString()}`}
          icon={ShoppingCart}
          iconColor="text-ink-muted"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Spend Bar Chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink mb-4">每月消費金額</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySpend ?? []} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} width={50}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
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
              <Pie data={categoryData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span style={{ fontSize: 12, color: '#1E293B' }}>{v}</span>}
              />
              <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expiring Soon */}
      {expiring && expiring.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-ink mb-4">即將到期提醒</h2>
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
                  <td className="font-medium text-ink">{product.name}</td>
                  <td className="text-ink-muted">{product.brand}</td>
                  <td className="text-ink-muted tabular-nums">
                    {format(parseISO(expiryDate), 'yyyy/MM/dd')}
                  </td>
                  <td className="tabular-nums font-medium">
                    {daysUntilExpiry < 0 ? `已過期 ${Math.abs(daysUntilExpiry)} 天` : `${daysUntilExpiry} 天`}
                  </td>
                  <td>
                    <AlertBadge level={alertLevel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
