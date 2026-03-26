import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Leaf } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
            <Leaf size={24} className="text-white" />
          </div>
          <h1 className="font-heading font-semibold text-xl text-ink">VitaShelf</h1>
          <p className="text-sm text-ink-muted">保養品與保健食品庫存管理</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
              電子郵件 <span className="text-status-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
              密碼 <span className="text-status-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className="input pr-16"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink cursor-pointer"
                aria-label={showPw ? '隱藏密碼' : '顯示密碼'}
              >
                {showPw ? '隱藏' : '顯示'}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-status-danger">
              {error}
            </p>
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

        <p className="text-center text-sm text-ink-muted">
          還沒有帳號？{' '}
          <a href="/register" className="text-primary hover:underline">
            立即註冊
          </a>
        </p>
      </div>
    </div>
  )
}
