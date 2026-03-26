import axios from 'axios'
import type {
  Product,
  PurchaseRecord,
  StockLog,
  DashboardStats,
  ExpiringProduct,
  PaginatedResponse,
  Tag,
} from '@/types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to /login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: { id: string; email: string; displayName: string } }>(
      '/auth/login',
      { email, password },
    ),
  register: (email: string, password: string, displayName: string) =>
    api.post('/auth/register', { email, password, displayName }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/users/me'),
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
  logs: (productId?: string) =>
    api.get<PaginatedResponse<StockLog>>('/stock/logs', { params: { productId } }),
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
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const exportApi = {
  products: () =>
    api.get('/export/products', { responseType: 'blob' }),
  purchases: () =>
    api.get('/export/purchases', { responseType: 'blob' }),
}

export default api
