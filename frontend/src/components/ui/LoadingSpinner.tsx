import { clsx } from 'clsx'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-[3px]',
}

export default function LoadingSpinner({ size = 'md', className }: Props) {
  return (
    <div
      className={clsx(
        'rounded-full border-primary/20 border-t-primary animate-spin',
        sizeMap[size],
        className,
      )}
      role="status"
      aria-label="載入中"
    />
  )
}
