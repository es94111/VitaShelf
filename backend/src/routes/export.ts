import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { format } from 'date-fns'

const router = Router()
const prisma = new PrismaClient()

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
}

// GET /api/export/products
router.get('/products', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { userId: req.user!.userId, isDeleted: false },
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const csv = toCsv(
      ['名稱', '品牌', '分類', '子分類', '規格', '條碼', '標籤', '建立日期'],
      products.map((p) => [
        p.name, p.brand,
        p.category === 'SKINCARE' ? '保養品' : '保健食品',
        p.subCategory, p.spec, p.barcode,
        p.tags.map((pt) => pt.tag.name).join('|'),
        format(p.createdAt, 'yyyy-MM-dd'),
      ]),
    )

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="vitashelf-products-${format(new Date(), 'yyyyMMdd')}.csv"`)
    res.send('\uFEFF' + csv)  // BOM for Excel UTF-8
  } catch (err) { next(err) }
})

// GET /api/export/purchases
router.get('/purchases', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const purchases = await prisma.purchaseRecord.findMany({
      where: { product: { userId: req.user!.userId } },
      include: { product: { select: { name: true, brand: true } } },
      orderBy: { purchaseDate: 'desc' },
    })

    const csv = toCsv(
      ['產品名稱', '品牌', '購買日期', '數量', '單價', '總價', '通路', '有效日期', '備註'],
      purchases.map((p) => [
        p.product.name, p.product.brand,
        format(p.purchaseDate, 'yyyy-MM-dd'),
        p.quantity,
        p.unitPrice?.toString(), p.totalPrice?.toString(),
        p.channel,
        format(p.expiryDate, 'yyyy-MM-dd'),
        p.notes,
      ]),
    )

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="vitashelf-purchases-${format(new Date(), 'yyyyMMdd')}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (err) { next(err) }
})

export default router
