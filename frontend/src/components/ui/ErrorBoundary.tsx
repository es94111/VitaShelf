import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional custom fallback UI */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error:    Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback)  return this.props.fallback

    return (
      <div
        role="alert"
        className="min-h-screen bg-surface flex items-center justify-center px-4"
      >
        <div className="card max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle size={28} className="text-status-danger" aria-hidden="true" />
            </div>
          </div>

          <div>
            <h1 className="text-lg font-heading font-semibold text-ink">發生未預期的錯誤</h1>
            <p className="text-sm text-ink-muted mt-1">
              頁面載入時發生錯誤。請嘗試重新整理，或回到首頁繼續使用。
            </p>
          </div>

          {this.state.error && (
            <details className="text-left">
              <summary className="text-xs text-ink-muted cursor-pointer hover:text-ink">
                錯誤詳情
              </summary>
              <pre className="mt-2 text-xs text-status-danger bg-red-50 rounded p-3 overflow-auto max-h-32 whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            </details>
          )}

          <div className="flex justify-center gap-3">
            <button
              className="btn-secondary"
              onClick={this.handleReset}
            >
              <RefreshCw size={14} aria-hidden="true" /> 重試
            </button>
            <a href="/" className="btn btn-primary">
              回到首頁
            </a>
          </div>
        </div>
      </div>
    )
  }
}
