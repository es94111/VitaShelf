import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  trend?: string
  trendUp?: boolean
}

export default function StatCard({ title, value, icon: Icon, iconColor = 'text-primary', trend, trendUp }: Props) {
  return (
    <div className="card flex items-start gap-4">
      <div className={clsx('p-2 rounded-md bg-surface', iconColor)}>
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink-muted font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-heading font-semibold text-ink mt-0.5 tabular-nums">{value}</p>
        {trend && (
          <p className={clsx('text-xs mt-1', trendUp ? 'text-status-ok' : 'text-status-danger')}>
            {trend}
          </p>
        )}
      </div>
    </div>
  )
}
