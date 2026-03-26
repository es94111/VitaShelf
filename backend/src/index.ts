import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { errorHandler } from './middleware/errorHandler'
import authRoutes     from './routes/auth'
import productRoutes  from './routes/products'
import purchaseRoutes from './routes/purchases'
import stockRoutes    from './routes/stock'
import alertRoutes    from './routes/alerts'
import dashboardRoutes from './routes/dashboard'
import tagRoutes      from './routes/tags'
import exportRoutes   from './routes/export'
import logger         from './middleware/logger'

const app = express()
const PORT = process.env.PORT ?? 4000

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(logger)

// ─── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(process.env.UPLOAD_DIR ?? './uploads'))

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes)
app.use('/api/users',     authRoutes)
app.use('/api/products',  productRoutes)
app.use('/api/purchases', purchaseRoutes)
app.use('/api/stock',     stockRoutes)
app.use('/api/alerts',    alertRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/tags',      tagRoutes)
app.use('/api/export',    exportRoutes)

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() })
})

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`VitaShelf API running on port ${PORT}`)
})

export default app
