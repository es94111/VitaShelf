// ─── Enums ────────────────────────────────────────────────────────────────────

export type ProductCategory = 'skincare' | 'supplement'

export type StockLogType = 'IN' | 'OUT_USE' | 'OUT_DISCARD' | 'ADJUST'

export type AlertLevel = 'ok' | 'warn' | 'danger' | 'expired'

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Product {
  id: string
  name: string
  brand: string
  category: ProductCategory
  subCategory?: string
  spec?: string
  barcode?: string
  imageUrl?: string
  notes?: string
  tags: Tag[]
  purchases?: PurchaseRecord[]
  currentStock: number
  alertLevel: AlertLevel
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface PurchaseRecord {
  id: string
  productId: string
  product?: Product
  purchaseDate: string
  quantity: number
  unitPrice?: number
  totalPrice?: number
  channel?: string
  receiptUrl?: string
  manufactureDate?: string
  expiryDate: string
  openedDate?: string
  paoMonths?: number
  notes?: string
  createdAt: string
}

export interface StockLog {
  id: string
  productId: string
  product?: Product
  type: StockLogType
  quantity: number
  reason?: string
  createdAt: string
}

export interface User {
  id: string
  email: string
  displayName: string
  role: 'ADMIN' | 'USER' | 'VIEWER'
  theme?: string
  authProvider?: string
  createdAt: string
}

export interface LoginLog {
  id: string
  userId?: string
  email: string
  ip: string
  country: string
  method: string
  success: boolean
  reason?: string
  createdAt: string
}

// ─── API Response wrappers ────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiError {
  message: string
  code?: string
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalProducts: number
  skincareCount: number
  supplementCount: number
  expiringIn7Days: number
  expiringIn30Days: number
  expiredCount: number
  lowStockCount: number
  totalSpentThisMonth: number
}

export interface ExpiringProduct {
  product: Product
  expiryDate: string
  daysUntilExpiry: number
  alertLevel: AlertLevel
}
