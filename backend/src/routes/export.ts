import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import archiver from 'archiver'
import path from 'path'
import fs from 'fs'
import prisma from '../utils/prisma.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { heavyRateLimit } from '../middleware/rateLimit.js'
import { format } from 'date-fns'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const router = Router()

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.resolve(__dirname, '../../uploads')

// 僅允許 /uploads/<safe-filename>.<ext>，避免任意路徑被當成圖片打包
const SAFE_IMAGE_PATH_RE = /^\/uploads\/([A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp|avif))$/i

// Router-wide rate limit (inline for CodeQL recognition).
router.use(rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false }))

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    const raw = String(v ?? '')
    // Prevent CSV/Formula injection when opened in spreadsheet apps.
    // Some apps ignore leading control characters/whitespace before evaluating formulas.
    // Prefix dangerous values with apostrophe even when [=+-@] is preceded by them.
    const s = /^[\u0000-\u0020\u007f]*[=+\-@]/.test(raw) ? `'${raw}` : raw
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
}

// GET /api/export/products
router.get('/products', authenticate, heavyRateLimit, async (req: AuthRequest, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { userId: req.user!.userId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    })

    const csv = toCsv(
      ['name', 'brand', 'category', 'subCategory', 'spec', 'barcode', 'notes', 'imageUrl'],
      products.map((p) => [
        p.name,
        p.brand,
        p.category === 'SKINCARE' ? 'skincare' : 'supplement',
        p.subCategory,
        p.spec,
        p.barcode,
        p.notes,
        p.imageUrl,
      ]),
    )

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="vitashelf-products-${format(new Date(), 'yyyyMMdd')}.csv"`)
    res.send('\uFEFF' + csv)  // BOM for Excel UTF-8
  } catch (err) { next(err) }
})

// GET /api/export/purchases
router.get('/purchases', authenticate, heavyRateLimit, async (req: AuthRequest, res, next) => {
  try {
    const purchases = await prisma.purchaseRecord.findMany({
      where: { product: { userId: req.user!.userId } },
      include: { product: { select: { name: true, brand: true } } },
      orderBy: { purchaseDate: 'desc' },
    })

    const csv = toCsv(
      ['productId', 'productName', 'productBrand', 'purchaseDate', 'quantity', 'expiryDate', 'unitPrice', 'totalPrice', 'channel', 'manufactureDate', 'openedDate', 'paoMonths', 'notes'],
      purchases.map((p) => [
        p.productId,
        p.product.name,
        p.product.brand,
        format(p.purchaseDate, 'yyyy-MM-dd'),
        p.quantity,
        format(p.expiryDate, 'yyyy-MM-dd'),
        p.unitPrice?.toString(),
        p.totalPrice?.toString(),
        p.channel,
        p.manufactureDate ? format(p.manufactureDate, 'yyyy-MM-dd') : '',
        p.openedDate ? format(p.openedDate, 'yyyy-MM-dd') : '',
        p.paoMonths,
        p.notes,
      ]),
    )

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="vitashelf-purchases-${format(new Date(), 'yyyyMMdd')}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (err) { next(err) }
})

// GET /api/export/all  — 一鍵打包：CSV + 圖片，輸出 ZIP
router.get('/all', authenticate, heavyRateLimit, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId

    // 並行抓取資料
    const [products, purchases, stockLogs, tags] = await Promise.all([
      prisma.product.findMany({
        where:   { userId },
        include: { tags: { include: { tag: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchaseRecord.findMany({
        where:   { product: { userId } },
        include: { product: { select: { name: true, brand: true } } },
        orderBy: { purchaseDate: 'desc' },
      }),
      prisma.stockLog.findMany({
        where:   { product: { userId } },
        include: { product: { select: { name: true, brand: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tag.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    ])

    // ── 產品 CSV（含 isDeleted、imageUrl、tags） ───────────────────────────────
    const productsCsv = toCsv(
      ['name','brand','category','subCategory','spec','barcode','notes','imageUrl','isDeleted','tags'],
      products.map((p) => [
        p.name,
        p.brand,
        p.category === 'SKINCARE' ? 'skincare' : 'supplement',
        p.subCategory,
        p.spec,
        p.barcode,
        p.notes,
        p.imageUrl,
        p.isDeleted ? 'true' : 'false',
        p.tags.map((pt) => pt.tag.name).join('|'),
      ]),
    )

    // ── 購買紀錄 CSV ─────────────────────────────────────────────────────────
    const purchasesCsv = toCsv(
      ['productId','productName','productBrand','purchaseDate','quantity','expiryDate','unitPrice','totalPrice','channel','manufactureDate','openedDate','paoMonths','notes'],
      purchases.map((p) => [
        p.productId,
        p.product.name,
        p.product.brand,
        format(p.purchaseDate, 'yyyy-MM-dd'),
        p.quantity,
        format(p.expiryDate, 'yyyy-MM-dd'),
        p.unitPrice?.toString(),
        p.totalPrice?.toString(),
        p.channel,
        p.manufactureDate ? format(p.manufactureDate, 'yyyy-MM-dd') : '',
        p.openedDate ? format(p.openedDate, 'yyyy-MM-dd') : '',
        p.paoMonths,
        p.notes,
      ]),
    )

    // ── 庫存紀錄 CSV ─────────────────────────────────────────────────────────
    const stockLogsCsv = toCsv(
      ['productId','productName','productBrand','type','quantity','reason','createdAt'],
      stockLogs.map((s) => [
        s.productId,
        s.product.name,
        s.product.brand,
        s.type,
        s.quantity,
        s.reason,
        format(s.createdAt, 'yyyy-MM-dd HH:mm:ss'),
      ]),
    )

    // ── 標籤 CSV ────────────────────────────────────────────────────────────
    const tagsCsv = toCsv(
      ['name','color'],
      tags.map((t) => [t.name, t.color]),
    )

    // ── 收集要打包的圖片（去重 + 路徑驗證） ────────────────────────────────
    const imageFiles = new Map<string, string>()  // archiveName -> absPath
    for (const p of products) {
      if (!p.imageUrl) continue
      const m = SAFE_IMAGE_PATH_RE.exec(p.imageUrl)
      if (!m) continue
      const filename = m[1]
      if (filename.includes('..') || imageFiles.has(filename)) continue
      const abs = path.resolve(UPLOAD_DIR, filename)
      // 防 path traversal：絕對路徑必須位於 UPLOAD_DIR 之下
      if (!abs.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) continue
      if (!fs.existsSync(abs)) continue
      imageFiles.set(filename, abs)
    }

    const dateStr = format(new Date(), 'yyyyMMdd')
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="vitashelf-backup-${dateStr}.zip"`)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('warning', (err) => {
      if (err.code !== 'ENOENT') next(err)
    })
    archive.on('error', (err) => next(err))
    archive.pipe(res)

    // CSV 加 BOM 讓 Excel 正確顯示中文
    archive.append('\uFEFF' + productsCsv,  { name: 'products.csv' })
    archive.append('\uFEFF' + purchasesCsv, { name: 'purchases.csv' })
    archive.append('\uFEFF' + stockLogsCsv, { name: 'stock_logs.csv' })
    archive.append('\uFEFF' + tagsCsv,      { name: 'tags.csv' })

    for (const [filename, abs] of imageFiles) {
      archive.file(abs, { name: `images/${filename}` })
    }

    const manifest = {
      app:         'VitaShelf',
      exportedAt:  new Date().toISOString(),
      counts: {
        products:  products.length,
        purchases: purchases.length,
        stockLogs: stockLogs.length,
        tags:      tags.length,
        images:    imageFiles.size,
      },
      files: [
        'products.csv',
        'purchases.csv',
        'stock_logs.csv',
        'tags.csv',
        ...Array.from(imageFiles.keys()).map((f) => `images/${f}`),
      ],
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

    await archive.finalize()
  } catch (err) { next(err) }
})

export default router
