import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Products from '@/pages/Products'
import Alerts from '@/pages/Alerts'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
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
          <Route path="products" element={<Products />} />
          <Route path="alerts" element={<Alerts />} />
          {/* Placeholder routes — implemented in future phases */}
          <Route path="purchases"  element={<PlaceholderPage title="購買紀錄" />} />
          <Route path="categories" element={<PlaceholderPage title="分類標籤" />} />
          <Route path="settings"   element={<PlaceholderPage title="設定" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-heading font-semibold text-ink">{title}</h1>
      <p className="text-sm text-ink-muted mt-2">此頁面將在後續版本開發完成</p>
    </div>
  )
}
