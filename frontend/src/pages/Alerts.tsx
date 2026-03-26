import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, XCircle, TrendingDown } from 'lucide-react'
import { alertsApi } from '@/services/api'
import AlertBadge from '@/components/ui/AlertBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { format, parseISO } from 'date-fns'

export default function Alerts() {
  const { data: expiring, isLoading: l1 } = useQuery({
    queryKey: ['alerts-expiring'],
    queryFn: () => alertsApi.expiring().then((r) => r.data),
  })

  const { data: expired, isLoading: l2 } = useQuery({
    queryKey: ['alerts-expired'],
    queryFn: () => alertsApi.expired().then((r) => r.data),
  })

  const { data: lowStock, isLoading: l3 } = useQuery({
    queryKey: ['alerts-low-stock'],
    queryFn: () => alertsApi.lowStock().then((r) => r.data),
  })

  const isLoading = l1 || l2 || l3

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-semibold text-ink">到期提醒</h1>

      {/* Summary Chips */}
      <div className="flex flex-wrap gap-3">
        <Chip icon={AlertTriangle} label="緊急到期（7天內）" count={expiring?.filter(e => e.alertLevel === 'danger').length ?? 0} color="text-status-danger" />
        <Chip icon={Clock}         label="即將到期（30天內）" count={expiring?.filter(e => e.alertLevel === 'warn').length ?? 0}   color="text-status-warn" />
        <Chip icon={XCircle}       label="已過期"            count={expired?.length ?? 0}    color="text-status-expired" />
        <Chip icon={TrendingDown}  label="低庫存"            count={lowStock?.length ?? 0}   color="text-accent" />
      </div>

      {/* Expiring Table */}
      {!!expiring?.length && (
        <Section title="即將到期產品">
          <table className="table-base" aria-label="即將到期產品">
            <thead><tr><th>產品</th><th>品牌</th><th>到期日</th><th>剩餘天數</th><th>狀態</th></tr></thead>
            <tbody>
              {expiring.map(({ product, expiryDate, daysUntilExpiry, alertLevel }) => (
                <tr key={product.id}>
                  <td className="font-medium text-ink">{product.name}</td>
                  <td className="text-ink-muted">{product.brand}</td>
                  <td className="tabular-nums text-ink-muted">{format(parseISO(expiryDate), 'yyyy/MM/dd')}</td>
                  <td className="tabular-nums font-semibold">{daysUntilExpiry} 天</td>
                  <td><AlertBadge level={alertLevel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Expired Table */}
      {!!expired?.length && (
        <Section title="已過期產品">
          <table className="table-base" aria-label="已過期產品">
            <thead><tr><th>產品</th><th>品牌</th><th>到期日</th><th>狀態</th></tr></thead>
            <tbody>
              {expired.map(({ product, expiryDate, alertLevel }) => (
                <tr key={product.id}>
                  <td className="font-medium text-ink">{product.name}</td>
                  <td className="text-ink-muted">{product.brand}</td>
                  <td className="tabular-nums text-status-expired">{format(parseISO(expiryDate), 'yyyy/MM/dd')}</td>
                  <td><AlertBadge level={alertLevel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {!expiring?.length && !expired?.length && (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="p-4 rounded-full bg-green-50 mb-4">
            <AlertTriangle size={32} className="text-status-ok" aria-hidden="true" />
          </div>
          <p className="font-semibold text-ink">目前沒有到期提醒</p>
          <p className="text-sm text-ink-muted mt-1">所有產品皆在有效期限內</p>
        </div>
      )}
    </div>
  )
}

function Chip({ icon: Icon, label, count, color }: {
  icon: typeof AlertTriangle; label: string; count: number; color: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-border bg-white text-sm">
      <Icon size={16} className={color} aria-hidden="true" />
      <span className="text-ink-muted">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{count}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </div>
  )
}
