import axios from 'axios'
import type {
  Product,
  PurchaseRecord,
  StockLog,
  DashboardStats,
  ExpiringProduct,
  PaginatedResponse,
  Tag,
  LoginLog,
} from '@/types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // 對應 T025 / R-008：讓瀏覽器自動夾帶 auth cookie
})

// 向下相容期間：若 localStorage 仍有舊 token（pre-cookie 遷移），附上 Bearer header；
// backend/src/middleware/auth.ts 於 cookie 缺失時 fallback 讀取 Authorization header。
// 待所有舊 token 過期後可移除此 interceptor。
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 處理：清除本地殘留憑證 + 導回登入（排除 /users/me 自身以避免登入頁載入時無限迴圈）
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const requestUrl: string = err.config?.url ?? ''
    if (status === 401 && !requestUrl.endsWith('/users/me')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)

/** 從 429 錯誤中抽出 retryAfterSeconds；優先 body，其次 Retry-After header（FR-023a/b）。 */
export function extractRetryAfter(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null
  const e = err as { response?: { status?: number; data?: { retryAfterSeconds?: unknown }; headers?: Record<string, string | string[] | undefined> } }
  if (e.response?.status !== 429) return null
  const bodyVal = e.response.data?.retryAfterSeconds
  if (typeof bodyVal === 'number' && bodyVal > 0) return bodyVal
  const headerVal = e.response.headers?.['retry-after']
  const h = Array.isArray(headerVal) ? headerVal[0] : headerVal
  if (typeof h === 'string') {
    const n = parseInt(h, 10)
    if (!Number.isNaN(n) && n > 0) return n
  }
  return null
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** FR-008：登入成功後 token 由 Set-Cookie 下發，回應 body 僅含 user。
 *  舊 Google SSO 路徑仍回 `{ token, user }` — 保留欄位以免破壞既有流程。 */
export interface AuthUserDTO {
  id: string
  email: string
  displayName: string
  role: string
  theme: string
  authProvider?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: AuthUserDTO }>('/auth/login', { email, password }),
  register: (email: string, password: string, displayName: string) =>
    api.post<{ user: AuthUserDTO }>('/auth/register', { email, password, displayName }),
  logout: () => api.post<{ message: string }>('/auth/logout'),
  me: () => api.get<AuthUserDTO>('/users/me'),
  registrationStatus: () =>
    api.get<{ open: boolean; notice: string; hasUsers: boolean }>('/auth/registration-status'),
  googleLogin: (idToken: string) =>
    api.post<{
      token?: string
      user: AuthUserDTO
    }>('/auth/google', { idToken }),
  googleEnabled: () =>
    api.get<{ enabled: boolean; clientId: string | null }>('/auth/google/enabled'),
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface ProductsQuery {
  page?: number
  pageSize?: number
  search?: string
  category?: string
  tag?: string
  sortBy?: 'name' | 'expiryDate' | 'createdAt' | 'currentStock'
  sortDir?: 'asc' | 'desc'
  deleted?: 'true' | 'false'
}

export const productsApi = {
  list: (query?: ProductsQuery) =>
    api.get<PaginatedResponse<Product>>('/products', { params: query }),
  get: (id: string) => api.get<Product>(`/products/${id}`),
  create: (data: FormData) =>
    api.post<Product>('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string, data: FormData) =>
    api.put<Product>(`/products/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string) => api.delete(`/products/${id}`),
  restore: (id: string) => api.post(`/products/${id}/restore`),
}

// ─── Uploads ─────────────────────────────────────────────────────────────────

export interface ServerImage {
  name:      string
  url:       string
  size:      number
  updatedAt: string
}

export const uploadsApi = {
  list: () => api.get<{ data: ServerImage[] }>('/uploads'),
}

// ─── Purchases ───────────────────────────────────────────────────────────────

export const purchasesApi = {
  list: (productId?: string) =>
    api.get<PaginatedResponse<PurchaseRecord>>('/purchases', { params: { productId } }),
  create: (data: Partial<PurchaseRecord>) => api.post<PurchaseRecord>('/purchases', data),
  update: (id: string, data: Partial<PurchaseRecord>) =>
    api.put<PurchaseRecord>(`/purchases/${id}`, data),
  delete: (id: string) => api.delete(`/purchases/${id}`),
}

// ─── Stock ───────────────────────────────────────────────────────────────────

export const stockApi = {
  getByProduct: (productId: string) =>
    api.get<{ currentStock: number; openedCount: number; discardedCount: number }>(
      `/stock/${productId}`,
    ),
  adjust: (data: { productId: string; type: StockLog['type']; quantity: number; reason?: string }) =>
    api.post<StockLog>('/stock/adjust', data),
  logs: (params?: { productId?: string; page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<StockLog>>('/stock/logs', { params }),
  update: (id: string, data: { type?: StockLog['type']; quantity?: number; reason?: string }) =>
    api.put<StockLog>(`/stock/${id}`, data),
  delete: (id: string) => api.delete(`/stock/${id}`),
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const alertsApi = {
  expiring: () => api.get<ExpiringProduct[]>('/alerts/expiring'),
  expired:  () => api.get<ExpiringProduct[]>('/alerts/expired'),
  lowStock: () => api.get<Product[]>('/alerts/low-stock'),
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
  monthlySpend: () =>
    api.get<Array<{ month: string; amount: number }>>('/dashboard/monthly-spend'),
  categoryBreakdown: () =>
    api.get<Array<{ category: string; count: number }>>('/dashboard/category-breakdown'),
  brandBreakdown: () =>
    api.get<Array<{ brand: string; count: number }>>('/dashboard/brand-breakdown'),
  recentActivity: () =>
    api.get<Array<{
      id: string
      type: string
      quantity: number
      reason?: string
      createdAt: string
      product: { id: string; name: string }
    }>>('/dashboard/recent-activity'),
}

// ─── Import ───────────────────────────────────────────────────────────────────

export const importApi = {
  products: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ imported: number; errors: string[] }>('/import/products', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  purchases: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ imported: number; errors: string[] }>('/import/purchases', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export interface TagWithCount extends Tag {
  productCount: number
}

export const tagsApi = {
  list: () => api.get<TagWithCount[]>('/tags'),
  create: (data: { name: string; color: string }) => api.post<TagWithCount>('/tags', data),
  update: (id: string, data: { name: string; color: string }) =>
    api.put<TagWithCount>(`/tags/${id}`, data),
  delete: (id: string) => api.delete(`/tags/${id}`),
}

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersApi = {
  me: () => api.get('/users/me'),
  updateMe: (data: { displayName: string }) => api.put('/users/me', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/users/me/change-password', data),
  updateTheme: (theme: string) => api.put('/users/me/theme', { theme }),
  myLoginLogs: (params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<LoginLog>>('/users/me/login-logs', { params }),
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export const adminApi = {
  getSettings: () =>
    api.get<{ id: string; registrationOpen: boolean; registrationNotice: string }>('/admin/settings'),
  updateSettings: (data: { registrationOpen: boolean; registrationNotice?: string }) =>
    api.put('/admin/settings', data),
  listUsers: () =>
    api.get<Array<{
      id: string; email: string; displayName: string; role: string;
      authProvider: string; createdAt: string; updatedAt: string
    }>>('/admin/users'),
  updateUserRole: (id: string, role: string) =>
    api.put(`/admin/users/${id}/role`, { role }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  loginLogs: (params?: { page?: number; pageSize?: number; userId?: string; success?: string }) =>
    api.get<PaginatedResponse<LoginLog & { user?: { displayName: string; email: string } }>>(
      '/admin/login-logs', { params },
    ),
  deleteLoginLog: (id: string) => api.delete(`/admin/login-logs/${id}`),
  batchDeleteLoginLogs: (ids: string[]) =>
    api.post<{ deleted: number; failed?: number; errors?: string[]; message: string }>(
      '/admin/login-logs/batch-delete', { ids },
    ),
  triggerUpdate: () =>
    api.post<{ message: string }>('/admin/update'),
}

// ─── Changelog ───────────────────────────────────────────────────────────────

export interface ChangelogRelease {
  version: string
  date: string
  type: string
  summary: string
  changes: { tag: string; text: string }[]
}

export const changelogApi = {
  get: () => api.get<{ projectName: string; currentVersion: string; releases: ChangelogRelease[] }>('/changelog'),
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const exportApi = {
  products: () =>
    api.get('/export/products', { responseType: 'blob' }),
  purchases: () =>
    api.get('/export/purchases', { responseType: 'blob' }),
}

export default api
