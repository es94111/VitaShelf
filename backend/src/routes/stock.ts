import { Router } from 'express'
import prisma from '../utils/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

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

// PUT /api/stock/:id — Edit stock log
router.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const logId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const { type, quantity, reason } = req.body

    // Verify log ownership
    const log = await prisma.stockLog.findFirst({
      where: { id: logId, product: { userId: req.user!.userId } },
    })
    if (!log) {
      res.status(404).json({ message: '找不到此庫存異動記錄' })
      return
    }

    const updated = await prisma.stockLog.update({
      where: { id: logId },
      data: {
        type: type || undefined,
        quantity: quantity ? Number(quantity) : undefined,
        reason: reason ?? undefined,
      },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/stock/:id — Delete stock log
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const logId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    // Verify log ownership
    const log = await prisma.stockLog.findFirst({
      where: { id: logId, product: { userId: req.user!.userId } },
    })
    if (!log) {
      res.status(404).json({ message: '找不到此庫存異動記錄' })
      return
    }

    await prisma.stockLog.delete({ where: { id: logId } })
    res.json({ message: '已刪除' })
  } catch (err) {
    next(err)
  }
})

export default router
