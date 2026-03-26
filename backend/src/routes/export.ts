import { Router } from 'express'
import prisma from '../utils/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { format } from 'date-fns'

const router = Router()

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
      orderBy: { createdAt: 'desc' },
    })

    const csv = toCsv(
      ['name', 'brand', 'category', 'subCategory', 'spec', 'barcode', 'notes'],
      products.map((p) => [
        p.name,
        p.brand,
        p.category === 'SKINCARE' ? 'skincare' : 'supplement',
        p.subCategory,
        p.spec,
        p.barcode,
        p.notes,
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
      orderBy: { purchaseDate: 'desc' },
    })

    const csv = toCsv(
      ['productId', 'purchaseDate', 'quantity', 'expiryDate', 'unitPrice', 'totalPrice', 'channel', 'manufactureDate', 'openedDate', 'paoMonths', 'notes'],
      purchases.map((p) => [
        p.productId,
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

export default router
