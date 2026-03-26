import { useState, useCallback } from 'react'
import { authApi } from '@/services/api'

interface AuthUser {
  id: string
  email: string
  displayName: string
  role: string
  theme?: string
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
  }, [])

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const { data } = await authApi.googleLogin(idToken)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {})
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('theme')
    setUser(null)
    window.location.href = '/login'
  }, [])

  /** Update local user state (e.g. after editing displayName) without re-fetching */
  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...updates }
      localStorage.setItem('user', JSON.stringify(updated))
      return updated
    })
  }, [])

  const isAuthenticated = !!user
  const isAdmin = user?.role === 'ADMIN'

  return { user, login, loginWithGoogle, logout, updateUser, isAuthenticated, isAdmin }
}
