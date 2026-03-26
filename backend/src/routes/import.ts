import { Router } from 'express'
import multer from 'multer'
import { PrismaClient } from '@prisma/client'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// Memory storage — we only need the buffer, not a file on disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 }, // 2 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('僅接受 CSV 檔案'))
    }
  },
})

// ─── Simple CSV parser (handles basic quoted fields) ──────────────────────────

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  values.push(current.trim())
  return values
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase())
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

// ─── POST /api/import/products ────────────────────────────────────────────────
// Expected CSV columns: name, brand, category (skincare/supplement),
//                       subCategory, spec, barcode, notes

router.post(
  '/products',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ message: '請上傳 CSV 檔案' })
        return
      }

      const text = req.file.buffer.toString('utf-8')
      const rows = parseCSV(text)

      if (rows.length === 0) {
        res.status(400).json({ message: 'CSV 檔案無有效資料列' })
        return
      }

      let imported = 0
      const errors: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const lineNum = i + 2  // +2: 1-indexed + header row

        const name     = row['name']?.trim()
        const brand    = row['brand']?.trim()
        const category = row['category']?.trim().toLowerCase()

        if (!name)  { errors.push(`第 ${lineNum} 行：缺少 name`);  continue }
        if (!brand) { errors.push(`第 ${lineNum} 行：缺少 brand`); continue }
        if (category !== 'skincare' && category !== 'supplement') {
          errors.push(`第 ${lineNum} 行：category 必須為 skincare 或 supplement（目前值：${row['category']}）`)
          continue
        }

        try {
          await prisma.product.create({
            data: {
              name,
              brand,
              category: category === 'skincare' ? 'SKINCARE' : 'SUPPLEMENT',
              subCategory: row['subcategory']?.trim() || undefined,
              spec:        row['spec']?.trim()        || undefined,
              barcode:     row['barcode']?.trim()     || undefined,
              notes:       row['notes']?.trim()       || undefined,
              userId:      req.user!.userId,
            },
          })
          imported++
        } catch (e) {
          errors.push(`第 ${lineNum} 行：建立失敗（${(e as Error).message}）`)
        }
      }

      res.status(imported > 0 ? 201 : 400).json({ imported, errors })
    } catch (err) {
      next(err)
    }
  },
)

export default router
