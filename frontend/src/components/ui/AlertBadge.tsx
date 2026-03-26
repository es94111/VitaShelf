import { clsx } from 'clsx'
import type { AlertLevel } from '@/types'

const config: Record<AlertLevel, { label: string; className: string }> = {
  ok:      { label: '正常',   className: 'badge-ok'     },
  warn:    { label: '即將到期', className: 'badge-warn'   },
  danger:  { label: '緊急到期', className: 'badge-danger' },
  expired: { label: '已過期',  className: 'badge-danger' },
}

interface Props {
  level: AlertLevel
  className?: string
}

export default function AlertBadge({ level, className }: Props) {
  const { label, className: cls } = config[level]
  return (
    <span className={clsx(cls, className)} role="status" aria-label={label}>
      {label}
    </span>
  )
}
