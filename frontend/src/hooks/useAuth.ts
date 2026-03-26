import { useState, useCallback } from 'react'
import { authApi } from '@/services/api'

interface AuthUser {
  id: string
  email: string
  displayName: string
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

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {})
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    window.location.href = '/login'
  }, [])

  const isAuthenticated = !!user

  return { user, login, logout, isAuthenticated }
}
