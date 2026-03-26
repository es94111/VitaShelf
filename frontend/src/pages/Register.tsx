import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Leaf, AlertCircle } from 'lucide-react'
import { authApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Register() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registrationClosed, setRegistrationClosed] = useState(false)
  const [closedNotice, setClosedNotice] = useState('')

  // Check registration status
  useEffect(() => {
    authApi.registrationStatus().then(({ data }) => {
      if (!data.open && data.hasUsers) {
        setRegistrationClosed(true)
        setClosedNotice(data.notice || '目前不開放註冊')
      }
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!displayName.trim()) { setError('請輸入顯示名稱。'); return }
    if (!email.trim()) { setError('請輸入電子郵件。'); return }
    if (password.length < 6) { setError('密碼長度至少需要 6 個字元。'); return }
    if (password !== confirmPassword) { setError('兩次輸入的密碼不一致。'); return }

    setLoading(true)
    try {
      await authApi.register(email, password, displayName)
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (err: unknown) {
      if (
        typeof err === 'object' && err !== null && 'response' in err &&
        typeof (err as Record<string, unknown>).response === 'object'
      ) {
        const response = (err as { response: { data?: { message?: string } } }).response
        setError(response.data?.message ?? '註冊失敗，請稍後再試。')
      } else {
        setError('註冊失敗，請稍後再試。')
      }
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
          <p className="text-sm text-ink-muted dark:text-gray-400">建立新帳號</p>
        </div>

        {registrationClosed ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertCircle size={32} className="text-status-warn" />
            <p className="text-sm text-ink dark:text-gray-200 text-center">{closedNotice}</p>
            <Link to="/login" className="btn-primary">返回登入</Link>
          </div>
        ) : (
          <>
            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
                  顯示名稱 <span className="text-status-danger" aria-hidden="true">*</span>
                </label>
                <input
                  id="displayName" type="text"
                  className="input dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  placeholder="你的名稱" autoComplete="name" required
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
                  電子郵件 <span className="text-status-danger" aria-hidden="true">*</span>
                </label>
                <input
                  id="email" type="email"
                  className="input dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  placeholder="you@example.com" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
                  密碼 <span className="text-status-danger" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password" type={showPw ? 'text' : 'password'}
                    className="input pr-16 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                    placeholder="至少 6 個字元" autoComplete="new-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
                    aria-label={showPw ? '隱藏密碼' : '顯示密碼'}
                  >
                    {showPw ? '隱藏' : '顯示'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink dark:text-gray-200 mb-1">
                  確認密碼 <span className="text-status-danger" aria-hidden="true">*</span>
                </label>
                <input
                  id="confirmPassword" type={showPw ? 'text' : 'password'}
                  className="input dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  placeholder="再次輸入密碼" autoComplete="new-password" required
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {error && <p role="alert" className="text-sm text-status-danger">{error}</p>}

              <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading} aria-busy={loading}>
                {loading ? <LoadingSpinner size="sm" /> : '註冊'}
              </button>
            </form>

            <p className="text-center text-sm text-ink-muted dark:text-gray-400">
              已經有帳號？{' '}
              <Link to="/login" className="text-primary hover:underline">返回登入</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
