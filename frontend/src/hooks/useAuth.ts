// 對應 T026 / R-008：以 TanStack Query 讀 /api/users/me 作為登入狀態的 single source of truth。
//
// 設計要點：
// - 認證憑證（JWT）由 httpOnly cookie 自動管理（FR-008），前端 MUST NOT 讀寫 token
// - 舊版本曾以 localStorage 儲存 user + token；為平滑轉換，登入/登出仍同步清除 localStorage
// - 對外介面（login / logout / updateUser / isAuthenticated / isAdmin）保留與舊版一致，
//   以免 Login.tsx、Settings.tsx、Sidebar 等舊消費者破碎
// - `useAuth()` 現在是 TanStack Query 包裝；同一次渲染可能先回 undefined、再回 user（query loading）

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, type AuthUserDTO } from '@/services/api'

export type AuthUser = AuthUserDTO

const ME_KEY = ['auth', 'me'] as const

export function useAuth() {
  const queryClient = useQueryClient()

  // 以 /me 為 SoT：cookie 有效 → 200 + user；否則 → 401
  // 401 interceptor 會自動跳轉到 /login（/me 自身除外，於 api.ts 內有 guard）
  const query = useQuery<AuthUser | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        const { data } = await authApi.me()
        return data as AuthUser
      } catch (err) {
        const status = (err as { response?: { status?: number } }).response?.status
        if (status === 401) return null  // 未登入
        throw err
      }
    },
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const user: AuthUser | null = query.data ?? null

  const login = useCallback(async (email: string, password: string) => {
    // 後端以 Set-Cookie 下發憑證；body 僅含 user
    const { data } = await authApi.login(email, password)
    // 寫入 React Query cache；同步更新 localStorage 以向下相容尚未遷移的元件
    queryClient.setQueryData(ME_KEY, data.user)
    try { localStorage.setItem('user', JSON.stringify(data.user)) } catch { /* ignore */ }
    localStorage.removeItem('token')  // cookie-only；清除任何殘留舊 token
  }, [queryClient])

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const { data } = await authApi.googleLogin(idToken)
    queryClient.setQueryData(ME_KEY, data.user)
    try { localStorage.setItem('user', JSON.stringify(data.user)) } catch { /* ignore */ }
    // 舊 Google SSO 路徑可能仍回 token；清除以確保 cookie-only
    if (data.token) localStorage.removeItem('token')
  }, [queryClient])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => { /* ignore network */ })
    queryClient.setQueryData(ME_KEY, null)
    queryClient.clear()
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('theme')
    window.location.href = '/login'
  }, [queryClient])

  /** 本地 patch user 狀態（例如改完 displayName 後不重新 fetch）。 */
  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    queryClient.setQueryData<AuthUser | null>(ME_KEY, (prev) =>
      prev ? ({ ...prev, ...updates }) : prev,
    )
    try {
      const raw = localStorage.getItem('user')
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser
        localStorage.setItem('user', JSON.stringify({ ...parsed, ...updates }))
      }
    } catch { /* ignore */ }
  }, [queryClient])

  const isAuthenticated = !!user
  const isAdmin = user?.role === 'ADMIN'

  return {
    user,
    login,
    loginWithGoogle,
    logout,
    updateUser,
    isAuthenticated,
    isAdmin,
    /** 供頁面判斷是否仍在查詢 /me（初次載入時） */
    isLoading: query.isLoading,
  }
}

/** Mutations（供需要直接拿 mutation 狀態的元件使用，例如 Login 倒數計時）。 */
export function useLoginMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(ME_KEY, data.user)
      try { localStorage.setItem('user', JSON.stringify(data.user)) } catch { /* ignore */ }
      localStorage.removeItem('token')
    },
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => authApi.logout().then((r) => r.data),
    onSettled: () => {
      queryClient.setQueryData(ME_KEY, null)
      queryClient.clear()
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('theme')
    },
  })
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: ({ email, password, displayName }: {
      email: string
      password: string
      displayName: string
    }) => authApi.register(email, password, displayName).then((r) => r.data),
  })
}
