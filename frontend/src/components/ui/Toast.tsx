import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  success: (msg: string) => void
  error:   (msg: string) => void
  warning: (msg: string) => void
  info:    (msg: string) => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ─── Config ───────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

const STYLES: Record<ToastType, string> = {
  success: 'bg-white border-status-ok  text-status-ok',
  error:   'bg-white border-status-danger text-status-danger',
  warning: 'bg-white border-status-warn  text-status-warn',
  info:    'bg-white border-primary      text-primary',
}

const AUTO_DISMISS_MS = 4000

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const add = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev.slice(-4), { id, type, message }])
    timers.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }, [dismiss])

  const value: ToastContextValue = {
    success: (m) => add('success', m),
    error:   (m) => add('error',   m),
    warning: (m) => add('warning', m),
    info:    (m) => add('info',    m),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container — screen-reader live region */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type]
          return (
            <div
              key={toast.id}
              role="status"
              className={clsx(
                'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-modal text-sm',
                'animate-[slideInRight_150ms_ease-out]',
                STYLES[toast.type],
              )}
            >
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-ink leading-snug">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 p-0.5 rounded hover:bg-surface transition-colors cursor-pointer"
                aria-label="關閉通知"
              >
                <X size={14} className="text-ink-muted" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
