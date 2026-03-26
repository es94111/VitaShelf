import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  rounded?: boolean
}

/** Single skeleton block — shimmer effect */
export function Skeleton({ className, rounded }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-slate-200',
        rounded ? 'rounded-full' : 'rounded',
        className,
      )}
      aria-hidden="true"
    />
  )
}

/** Skeleton for a stat card */
export function StatCardSkeleton() {
  return (
    <div className="card flex items-start gap-4">
      <Skeleton className="w-9 h-9" rounded />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-16" />
      </div>
    </div>
  )
}

/** Skeleton for a table row */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4" style={{ width: `${60 + (i * 17) % 40}%` } as React.CSSProperties} />
        </td>
      ))}
    </tr>
  )
}

/** Skeleton for the product list table */
export function ProductListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border">
        <Skeleton className="h-4 w-32" />
      </div>
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={6} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
