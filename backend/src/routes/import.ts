import { Router } from 'express'
import multer from 'multer'
import prisma from '../utils/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

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
  const headers = parseCSVLine(lines[0]).map((h, idx) => {
    const key = h.toLowerCase()
    return idx === 0 ? key.replace(/^\ufeff/, '') : key
  })
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function toOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : NaN
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? undefined : d
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

// ─── POST /api/import/purchases ──────────────────────────────────────────────
// Expected CSV columns: productId, productName, productBrand, purchaseDate, quantity, expiryDate,
//                       unitPrice, totalPrice, channel, manufactureDate,
//                       openedDate, paoMonths, notes
// productId is optional; if missing, matches by productName + productBrand instead

router.post(
  '/purchases',
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
        const lineNum = i + 2

        const productId = row['productid']?.trim()
        const productName = row['productname']?.trim()
        const productBrand = row['productbrand']?.trim()
        const purchaseDate = toDate(row['purchasedate'])
        const expiryDate = toDate(row['expirydate'])
        const quantity = toOptionalNumber(row['quantity'])
        const unitPrice = toOptionalNumber(row['unitprice'])
        const totalPrice = toOptionalNumber(row['totalprice'])
        const paoMonths = toOptionalNumber(row['paomonths'])
        const manufactureDate = toDate(row['manufacturedate'])
        const openedDate = toDate(row['openeddate'])

        if (!purchaseDate) {
          errors.push(`第 ${lineNum} 行：purchaseDate 格式錯誤或缺少`)
          continue
        }
        if (!expiryDate) {
          errors.push(`第 ${lineNum} 行：expiryDate 格式錯誤或缺少`)
          continue
        }
        if (!Number.isInteger(quantity) || (quantity ?? 0) <= 0) {
          errors.push(`第 ${lineNum} 行：quantity 必須是大於 0 的整數`)
          continue
        }
        if (unitPrice !== undefined && Number.isNaN(unitPrice)) {
          errors.push(`第 ${lineNum} 行：unitPrice 格式錯誤`)
          continue
        }
        if (totalPrice !== undefined && Number.isNaN(totalPrice)) {
          errors.push(`第 ${lineNum} 行：totalPrice 格式錯誤`)
          continue
        }
        if (paoMonths !== undefined && (!Number.isInteger(paoMonths) || paoMonths <= 0)) {
          errors.push(`第 ${lineNum} 行：paoMonths 必須是大於 0 的整數`)
          continue
        }

        const quantityInt = quantity as number

        try {
          let targetProductId: string | undefined

          // Try to find product first by productId
          if (productId) {
            const product = await prisma.product.findFirst({
              where: { id: productId, userId: req.user!.userId },
              select: { id: true },
            })
            if (product) {
              targetProductId = product.id
            }
          }

          // If productId not found, try to match by productName + productBrand (cross-account support)
          if (!targetProductId && productName && productBrand) {
            const product = await prisma.product.findFirst({
              where: {
                name: productName,
                brand: productBrand,
                userId: req.user!.userId,
              },
              select: { id: true },
            })
            if (product) {
              targetProductId = product.id
            }
          }

          if (!targetProductId) {
            if (productId) {
              errors.push(`第 ${lineNum} 行：找不到 productId 或產品不屬於目前使用者`)
            } else if (productName && productBrand) {
              errors.push(`第 ${lineNum} 行：找不到匹配的產品（${productName} / ${productBrand}）`)
            } else {
              errors.push(`第 ${lineNum} 行：缺少 productId 或 productName / productBrand`)
            }
            continue
          }

          await prisma.$transaction(async (tx) => {
            await tx.purchaseRecord.create({
              data: {
                productId: targetProductId!,
                purchaseDate,
                quantity: quantityInt,
                unitPrice,
                totalPrice,
                channel: row['channel']?.trim() || undefined,
                expiryDate,
                manufactureDate,
                openedDate,
                paoMonths,
                notes: row['notes']?.trim() || undefined,
              },
            })

            await tx.stockLog.create({
              data: {
                productId: targetProductId!,
                type: 'IN',
                quantity: quantityInt,
                reason: `購買匯入 — ${row['channel']?.trim() || ''}`.trim(),
              },
            })
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
