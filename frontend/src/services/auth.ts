// 認證模組專用服務層（對應 T032）— 以 OpenAPI 3.2 生成型別為合約事實，
// 確保 frontend 呼叫面貌與 specs/001-auth-module/contracts/auth.openapi.yaml 完全一致。
//
// 這是 authApi（於 services/api.ts）的 type-safe 包裝；新程式碼應優先使用本檔的匯出。

import api, { authApi } from './api'
import type { components } from '@/types/auth-api'

// ─── 型別從 OpenAPI 產生（不手刻）──────────────────────────────────────────

export type User = components['schemas']['User']
export type RegisterRequest = components['schemas']['RegisterRequest']
export type LoginRequest = components['schemas']['LoginRequest']
export type ChangePasswordRequest = components['schemas']['ChangePasswordRequest']
export type UpdateProfileRequest = components['schemas']['UpdateProfileRequest']
export type ValidationError = components['schemas']['ValidationError']
export type RateLimitedResponse = components['schemas']['RateLimitedResponse']
export type GenericError = components['schemas']['GenericError']

// ─── Service 方法 ────────────────────────────────────────────────────────

export const auth = {
  /** US1 — 建立新帳號；成功 201 回傳 User（無 password 欄位）。 */
  register: (req: RegisterRequest) =>
    authApi.register(req.email, req.password, req.displayName).then((r) => r.data.user as User),

  /** US2 — 登入；憑證由 Set-Cookie 下發，回傳 body 僅 `{ user }`。 */
  login: (req: LoginRequest) =>
    authApi.login(req.email, req.password).then((r) => r.data.user as User),

  /** US3 — 登出；後端清除 auth cookie。 */
  logout: () => authApi.logout().then((r) => r.data),

  /** US4 — 取得當前使用者。 */
  me: () => authApi.me().then((r) => r.data as User),

  /** US4 — 更新顯示名稱或主題。 */
  updateProfile: (req: UpdateProfileRequest) =>
    api.put<User>('/users/me', req).then((r) => r.data),

  /** US5 — 變更密碼；成功後 cookie 被清除，需重新登入。 */
  changePassword: (req: ChangePasswordRequest) =>
    api.post<{ message: string }>('/users/me/change-password', req).then((r) => r.data),

  /** 註冊狀態（開放 / 關閉 / 公告）。 */
  registrationStatus: () =>
    authApi.registrationStatus().then((r) => r.data),
}

/** 嘗試將後端錯誤訊息轉為使用者可見的繁中訊息。
 *  優先使用 errors[].message（ValidationError）、其次 message（GenericError）。
 */
export function extractAuthErrorMessage(err: unknown, fallback = '操作失敗，請稍後再試。'): string {
  if (typeof err !== 'object' || err === null) return fallback
  const e = err as { response?: { data?: unknown } }
  const data = e.response?.data
  if (typeof data !== 'object' || data === null) return fallback
  // ValidationError 優先
  if ('errors' in data && Array.isArray((data as { errors: unknown[] }).errors)) {
    const first = (data as ValidationError).errors[0]
    if (first && typeof first.message === 'string') return first.message
  }
  // GenericError / 舊 response 皆使用 message
  if ('message' in data && typeof (data as { message: string }).message === 'string') {
    return (data as { message: string }).message
  }
  return fallback
}
