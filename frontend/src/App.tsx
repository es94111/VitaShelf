import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/ui/Toast'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Products from '@/pages/Products'
import ProductDetail from '@/pages/ProductDetail'
import Alerts from '@/pages/Alerts'
import Purchases from '@/pages/Purchases'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="products"        element={<Products />} />
            <Route path="products/:id"    element={<ProductDetail />} />
            <Route path="alerts"          element={<Alerts />} />
            <Route path="purchases"  element={<Purchases />} />
            {/* Phase 4+ placeholder routes */}
            <Route path="categories"      element={<PlaceholderPage title="分類標籤" phase="Phase 5" />} />
            <Route path="settings"        element={<PlaceholderPage title="設定"     phase="Phase 7" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}

function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-heading font-semibold text-ink">{title}</h1>
      <p className="text-sm text-ink-muted mt-2">此頁面將在 {phase} 開發完成</p>
    </div>
  )
}
