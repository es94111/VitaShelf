import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-surface mb-4">
        <Icon size={32} strokeWidth={1.5} className="text-ink-faint" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="text-sm text-ink-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
