import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Leaf } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { authApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
        }
      }
    }
  }
}

export default function Login() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const justRegistered = (location.state as { registered?: boolean })?.registered
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)

  // Check Google SSO availability
  useEffect(() => {
    authApi.googleEnabled().then(({ data }) => {
      setGoogleEnabled(data.enabled)
      setGoogleClientId(data.clientId)
    }).catch(() => {})
  }, [])

  // Initialize Google Sign-In button
  useEffect(() => {
    if (!googleEnabled || !googleClientId) return

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          setError('')
          setLoading(true)
          try {
            await loginWithGoogle(response.credential)
            navigate('/', { replace: true })
          } catch {
            setError('Google 登入失敗，請重試。')
          } finally {
            setLoading(false)
          }
        },
      })
      const el = document.getElementById('google-signin-btn')
      if (el) {
        window.google?.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          locale: 'zh-TW',
        })
      }
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [googleEnabled, googleClientId, loginWithGoogle, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch {
      setError('電子郵件或密碼不正確，請重試。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="card dark:bg-gray-900 dark:border-gray-700 w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
            <Leaf size={24} className="text-white" />
          </div>
          <h1 className="font-heading font-semibold text-xl text-ink dark:text-gray-100">VitaShelf</h1>
          <p className="text-sm text-ink-muted dark:text-gray-400">保養品與保健食品庫存管理</p>
        </div>

        {justRegistered && (
          <p className="text-sm text-status-ok bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 text-center">
            註冊成功！請使用新帳號登入。
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
              電子郵件 <span className="text-status-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              type="email"
              className="input dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
              密碼 <span className="text-status-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className="input pr-16 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
                aria-label={showPw ? '隱藏密碼' : '顯示密碼'}
              >
                {showPw ? '隱藏' : '顯示'}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-status-danger">{error}</p>
          )}

          <button
            type="submit"
            className="btn-primary w-full justify-center py-2.5"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? <LoadingSpinner size="sm" /> : '登入'}
          </button>
        </form>

        {/* Google SSO */}
        {googleEnabled && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-surface-border dark:bg-gray-700" />
              <span className="text-xs text-ink-muted dark:text-gray-500">或</span>
              <div className="flex-1 h-px bg-surface-border dark:bg-gray-700" />
            </div>
            <div id="google-signin-btn" className="flex justify-center" />
          </>
        )}

        <p className="text-center text-sm text-ink-muted dark:text-gray-400">
          還沒有帳號？{' '}
          <Link to="/register" className="text-primary hover:underline">立即註冊</Link>
        </p>
      </div>
    </div>
  )
}
