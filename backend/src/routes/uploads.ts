import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { readRateLimit } from '../middleware/rateLimit'

const router = Router()

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.resolve(__dirname, '../../uploads')
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])

// GET /api/uploads — 列出伺服器內所有已上傳的產品圖片
router.get('/', authenticate, readRateLimit, async (_req: AuthRequest, res, next) => {
  try {
    let entries: string[] = []
    try {
      entries = await fs.readdir(UPLOAD_DIR)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        res.json({ data: [] })
        return
      }
      throw err
    }

    const files = await Promise.all(
      entries
        .filter((name) => ALLOWED_EXT.has(path.extname(name).toLowerCase()))
        .map(async (name) => {
          const stat = await fs.stat(path.join(UPLOAD_DIR, name))
          if (!stat.isFile()) return null
          return {
            name,
            url:       `/uploads/${name}`,
            size:      stat.size,
            updatedAt: stat.mtime.toISOString(),
          }
        }),
    )

    const data = files
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    res.json({ data })
  } catch (err) {
    next(err)
  }
})

export default router
