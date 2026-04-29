// Express app factory — 將 app 組裝從 listen 分離，以便整合測試可直接載入。
// 呼叫者（index.ts 或 tests）自行決定是否呼叫 listen。

import express, { type Express } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middleware/errorHandler'
import { requireSameOrigin } from './middleware/csrf'
import authRoutes from './routes/auth'
import googleAuthRoutes from './routes/googleAuth'
import adminRoutes from './routes/admin'
import productRoutes from './routes/products'
import purchaseRoutes from './routes/purchases'
import stockRoutes from './routes/stock'
import alertRoutes from './routes/alerts'
import dashboardRoutes from './routes/dashboard'
import tagRoutes from './routes/tags'
import exportRoutes from './routes/export'
import importRoutes from './routes/import'
import changelogRoutes from './routes/changelog'
import uploadsRoutes from './routes/uploads'
import requestLogger from './middleware/logger'

export function createApp(): Express {
  const app = express()

  app.use(cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    exposedHeaders: ['Retry-After'],  // 對應 FR-023b
  }))
  app.use(cookieParser())
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(requestLogger)

  // ─── Global CSRF protection ──────────────────────────────────────────────
  // 對應 FR-012a + research.md R-001。
  //
  // 本模組採 `SameSite=Strict` cookie（瀏覽器層阻擋跨站請求）+ 此處的
  // `requireSameOrigin`（Origin/Referer 白名單）雙重防護；不引入 `csurf`
  // 等基於 double-submit token 的套件，因 httpOnly cookie 下無法安全讓 JS 讀 token。
  //
  // `requireSameOrigin` 內部 skip GET/HEAD/OPTIONS，因此所有讀取端點不受影響；
  // 僅 POST / PUT / PATCH / DELETE 需帶 Origin header（瀏覽器 fetch 自動帶；
  // 整合測試亦明確設定 Origin）。
  //
  // 註：CodeQL `js/missing-csrf-middleware` 規則僅辨識 csurf/lusca 等既有套件；
  // 本自訂中介層雖實際提供保護，仍可能被報為 false positive。
  app.use(requireSameOrigin)

  app.use('/uploads', express.static(process.env.UPLOAD_DIR ?? './uploads'))

  app.use('/api/auth',      authRoutes)
  app.use('/api/auth',      googleAuthRoutes)
  app.use('/api/users',     authRoutes)
  app.use('/api/admin',     adminRoutes)
  app.use('/api/products',  productRoutes)
  app.use('/api/purchases', purchaseRoutes)
  app.use('/api/stock',     stockRoutes)
  app.use('/api/alerts',    alertRoutes)
  app.use('/api/dashboard', dashboardRoutes)
  app.use('/api/tags',      tagRoutes)
  app.use('/api/export',    exportRoutes)
  app.use('/api/import',    importRoutes)
  app.use('/api/changelog', changelogRoutes)
  app.use('/api/uploads',   uploadsRoutes)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() })
  })

  app.use(errorHandler)
  return app
}
