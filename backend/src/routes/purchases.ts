import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/purchases
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { productId, page = '1', pageSize = '20' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(pageSize)

    const where = {
      product: { userId: req.user!.userId },
      ...(productId ? { productId } : {}),
    }

    const [purchases, total] = await Promise.all([
      prisma.purchaseRecord.findMany({
        where,
        include: { product: { select: { id: true, name: true, brand: true } } },
        orderBy: { purchaseDate: 'desc' },
        skip,
        take: Number(pageSize),
      }),
      prisma.purchaseRecord.count({ where }),
    ])

    res.json({ data: purchases, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) })
  } catch (err) {
    next(err)
  }
})

// POST /api/purchases
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { productId, purchaseDate, quantity, unitPrice, totalPrice, channel, expiryDate, manufactureDate, openedDate, paoMonths, notes } = req.body

    // Verify product ownership
    const product = await prisma.product.findFirst({ where: { id: productId, userId: req.user!.userId } })
    if (!product) { res.status(404).json({ message: '找不到此產品' }); return }

    const record = await prisma.purchaseRecord.create({
      data: {
        productId,
        purchaseDate: new Date(purchaseDate),
        quantity: Number(quantity),
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        totalPrice: totalPrice ? Number(totalPrice) : undefined,
        channel,
        expiryDate: new Date(expiryDate),
        manufactureDate: manufactureDate ? new Date(manufactureDate) : undefined,
        openedDate: openedDate ? new Date(openedDate) : undefined,
        paoMonths: paoMonths ? Number(paoMonths) : undefined,
        notes,
      },
    })

    // Auto-create stock IN log
    await prisma.stockLog.create({
      data: { productId, type: 'IN', quantity: Number(quantity), reason: `購買入庫 — ${channel ?? ''}` },
    })

    res.status(201).json(record)
  } catch (err) {
    next(err)
  }
})

// PUT /api/purchases/:id
router.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const purchaseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    const { purchaseDate, quantity, unitPrice, totalPrice, channel, expiryDate, notes } = req.body
    await prisma.purchaseRecord.update({
      where: { id: purchaseId },
      data: {
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        quantity: quantity ? Number(quantity) : undefined,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        totalPrice: totalPrice ? Number(totalPrice) : undefined,
        channel, expiryDate: expiryDate ? new Date(expiryDate) : undefined, notes,
      },
    })
    res.json({ message: '更新成功' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/purchases/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const purchaseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    await prisma.purchaseRecord.delete({ where: { id: purchaseId } })
    res.json({ message: '已刪除' })
  } catch (err) {
    next(err)
  }
})

export default router
