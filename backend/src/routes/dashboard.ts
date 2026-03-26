import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { startOfMonth, endOfMonth, subMonths, format, isPast, addDays } from 'date-fns'

const router = Router()
const prisma = new PrismaClient()

// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId
    const now = new Date()

    const [products, purchases, lowStockProducts] = await Promise.all([
      prisma.product.findMany({ where: { userId, isDeleted: false }, include: { stockLogs: true } }),
      prisma.purchaseRecord.findMany({ where: { product: { userId } }, select: { expiryDate: true, totalPrice: true, purchaseDate: true } }),
      prisma.product.count({ where: { userId, isDeleted: false } }),
    ])

    const skincareCount   = products.filter((p) => p.category === 'SKINCARE').length
    const supplementCount = products.filter((p) => p.category === 'SUPPLEMENT').length

    const expiringIn7Days  = purchases.filter((p) => !isPast(p.expiryDate) && isPast(addDays(p.expiryDate, -7))).length
    const expiringIn30Days = purchases.filter((p) => !isPast(p.expiryDate) && isPast(addDays(p.expiryDate, -30))).length
    const expiredCount     = purchases.filter((p) => isPast(p.expiryDate)).length

    const monthStart = startOfMonth(now)
    const monthEnd   = endOfMonth(now)
    const totalSpentThisMonth = purchases
      .filter((p) => p.purchaseDate >= monthStart && p.purchaseDate <= monthEnd)
      .reduce((sum, p) => sum + Number(p.totalPrice ?? 0), 0)

    // Low stock: currentStock <= 1
    const lowStockCount = products.filter((p) => {
      let stock = 0
      for (const log of p.stockLogs) {
        if (log.type === 'IN')           stock += log.quantity
        if (log.type === 'OUT_USE')      stock -= log.quantity
        if (log.type === 'OUT_DISCARD')  stock -= log.quantity
        if (log.type === 'ADJUST')       stock  = log.quantity
      }
      return Math.max(0, stock) <= 1
    }).length

    res.json({
      totalProducts: products.length,
      skincareCount,
      supplementCount,
      expiringIn7Days,
      expiringIn30Days,
      expiredCount,
      lowStockCount,
      totalSpentThisMonth,
    })
  } catch (err) { next(err) }
})

// GET /api/dashboard/monthly-spend  — last 6 months
router.get('/monthly-spend', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i))

    const result = await Promise.all(
      months.map(async (m) => {
        const purchases = await prisma.purchaseRecord.findMany({
          where: {
            product: { userId },
            purchaseDate: { gte: startOfMonth(m), lte: endOfMonth(m) },
          },
          select: { totalPrice: true },
        })
        return {
          month: format(m, 'M月'),
          amount: purchases.reduce((s, p) => s + Number(p.totalPrice ?? 0), 0),
        }
      }),
    )

    res.json(result)
  } catch (err) { next(err) }
})

// GET /api/dashboard/category-breakdown
router.get('/category-breakdown', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId
    const [skincare, supplement] = await Promise.all([
      prisma.product.count({ where: { userId, isDeleted: false, category: 'SKINCARE' } }),
      prisma.product.count({ where: { userId, isDeleted: false, category: 'SUPPLEMENT' } }),
    ])
    res.json([
      { category: '保養品',   count: skincare },
      { category: '保健食品', count: supplement },
    ])
  } catch (err) { next(err) }
})

// GET /api/dashboard/brand-breakdown — top 10 brands by product count
router.get('/brand-breakdown', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId
    const products = await prisma.product.findMany({
      where: { userId, isDeleted: false },
      select: { brand: true },
    })

    const brandMap = new Map<string, number>()
    for (const p of products) {
      brandMap.set(p.brand, (brandMap.get(p.brand) ?? 0) + 1)
    }

    const result = Array.from(brandMap.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    res.json(result)
  } catch (err) { next(err) }
})

// GET /api/dashboard/recent-activity — last 8 stock logs across all products
router.get('/recent-activity', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId
    const logs = await prisma.stockLog.findMany({
      where:   { product: { userId } },
      include: { product: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take:    8,
    })
    res.json(logs)
  } catch (err) { next(err) }
})

export default router
