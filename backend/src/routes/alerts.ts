import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { addDays, differenceInDays, isPast } from 'date-fns'

const router = Router()
const prisma = new PrismaClient()

function alertLevel(expiryDate: Date) {
  if (isPast(expiryDate)) return 'expired'
  const days = differenceInDays(expiryDate, new Date())
  if (days <= 7)  return 'danger'
  if (days <= 30) return 'warn'
  return 'ok'
}

async function getExpiringProducts(userId: string, cutoffDate: Date, onlyExpired = false) {
  const purchases = await prisma.purchaseRecord.findMany({
    where: {
      product: { userId, isDeleted: false },
      expiryDate: onlyExpired ? { lt: new Date() } : { lt: cutoffDate },
    },
    include: { product: true },
    orderBy: { expiryDate: 'asc' },
  })

  return purchases.map((p) => ({
    product: { ...p.product, category: p.product.category.toLowerCase() },
    expiryDate: p.expiryDate.toISOString(),
    daysUntilExpiry: differenceInDays(p.expiryDate, new Date()),
    alertLevel: alertLevel(p.expiryDate),
  }))
}

// GET /api/alerts/expiring  — next 30 days
router.get('/expiring', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = await getExpiringProducts(req.user!.userId, addDays(new Date(), 30))
    res.json(data.filter((d) => d.alertLevel !== 'expired'))
  } catch (err) { next(err) }
})

// GET /api/alerts/expired
router.get('/expired', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json(await getExpiringProducts(req.user!.userId, new Date(), true))
  } catch (err) { next(err) }
})

// GET /api/alerts/low-stock  — currentStock <= threshold (default 1)
router.get('/low-stock', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const threshold = Number(req.query.threshold ?? 1)
    const products = await prisma.product.findMany({
      where: { userId: req.user!.userId, isDeleted: false },
      include: { stockLogs: true },
    })

    const lowStock = products
      .map((p) => {
        let stock = 0
        for (const log of p.stockLogs) {
          if (log.type === 'IN')           stock += log.quantity
          if (log.type === 'OUT_USE')      stock -= log.quantity
          if (log.type === 'OUT_DISCARD')  stock -= log.quantity
          if (log.type === 'ADJUST')       stock  = log.quantity
        }
        return { ...p, stockLogs: undefined, currentStock: Math.max(0, stock) }
      })
      .filter((p) => p.currentStock <= threshold)

    res.json(lowStock)
  } catch (err) { next(err) }
})

export default router
