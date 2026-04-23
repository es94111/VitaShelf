// Express app factory — 將 app 組裝從 listen 分離，以便整合測試可直接載入。
// 呼叫者（index.ts 或 tests）自行決定是否呼叫 listen。

import express, { type Express } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middleware/errorHandler'
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

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() })
  })

  app.use(errorHandler)
  return app
}
