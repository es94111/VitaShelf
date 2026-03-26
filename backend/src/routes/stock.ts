import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

async function computeStock(productId: string) {
  const logs = await prisma.stockLog.findMany({ where: { productId } })
  let current = 0
  let opened = 0
  let discarded = 0
  for (const log of logs) {
    if (log.type === 'IN')          current   += log.quantity
    if (log.type === 'OUT_USE')   { current   -= log.quantity; opened    += log.quantity }
    if (log.type === 'OUT_DISCARD'){ current  -= log.quantity; discarded += log.quantity }
    if (log.type === 'ADJUST')      current    = log.quantity
  }
  return { currentStock: Math.max(0, current), openedCount: opened, discardedCount: discarded }
}

// GET /api/stock/:productId
router.get('/:productId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId
    const product = await prisma.product.findFirst({ where: { id: productId, userId: req.user!.userId } })
    if (!product) { res.status(404).json({ message: '找不到此產品' }); return }
    res.json(await computeStock(productId))
  } catch (err) {
    next(err)
  }
})

// POST /api/stock/adjust
router.post('/adjust', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { productId, type, quantity, reason } = req.body
    const product = await prisma.product.findFirst({ where: { id: productId, userId: req.user!.userId } })
    if (!product) { res.status(404).json({ message: '找不到此產品' }); return }
    const log = await prisma.stockLog.create({ data: { productId, type, quantity: Number(quantity), reason } })
    res.status(201).json(log)
  } catch (err) {
    next(err)
  }
})

// GET /api/stock/logs
router.get('/logs', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { productId, page = '1', pageSize = '30' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(pageSize)
    const where = {
      product: { userId: req.user!.userId },
      ...(productId ? { productId } : {}),
    }
    const [logs, total] = await Promise.all([
      prisma.stockLog.findMany({
        where,
        include: { product: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take: Number(pageSize),
      }),
      prisma.stockLog.count({ where }),
    ])
    res.json({ data: logs, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) })
  } catch (err) {
    next(err)
  }
})

export default router
