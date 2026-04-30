import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import prisma from '../utils/prisma.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { readRateLimit, writeRateLimit } from '../middleware/rateLimit.js'

const router = Router()

// Router-wide rate limit (inline for CodeQL recognition).
router.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }))

// GET /api/purchases
router.get('/', authenticate, readRateLimit, async (req: AuthRequest, res, next) => {
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
router.post('/', authenticate, writeRateLimit, async (req: AuthRequest, res, next) => {
  try {
    const { productId, purchaseDate, quantity, unitPrice, totalPrice, channel, expiryDate, manufactureDate, openedDate, paoMonths, notes } = req.body

    // Verify product ownership
    const product = await prisma.product.findFirst({ where: { id: productId, userId: req.user!.userId } })
    if (!product) { res.status(404).json({ message: '找不到此產品' }); return }

    // Create purchase record and linked stock IN log in a transaction
    const record = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchaseRecord.create({
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

      // Auto-create stock IN log linked to this purchase record
      await tx.stockLog.create({
        data: {
          productId,
          type: 'IN',
          quantity: Number(quantity),
          reason: `購買入庫 — ${channel ?? ''}`,
          purchaseRecordId: purchase.id,
        },
      })

      return purchase
    })

    res.status(201).json(record)
  } catch (err) {
    next(err)
  }
})

// PUT /api/purchases/:id
router.put('/:id', authenticate, writeRateLimit, async (req: AuthRequest, res, next) => {
  try {
    const purchaseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    // Verify ownership
    const existing = await prisma.purchaseRecord.findFirst({
      where: { id: purchaseId, product: { userId: req.user!.userId } },
    })
    if (!existing) { res.status(404).json({ message: '找不到此購買紀錄' }); return }

    const { purchaseDate, quantity, unitPrice, totalPrice, channel, expiryDate, manufactureDate, openedDate, paoMonths, notes } = req.body

    await prisma.$transaction(async (tx) => {
      await tx.purchaseRecord.update({
        where: { id: purchaseId },
        data: {
          purchaseDate:    purchaseDate    ? new Date(purchaseDate)    : undefined,
          quantity:        quantity        ? Number(quantity)          : undefined,
          unitPrice:       unitPrice       ? Number(unitPrice)         : undefined,
          totalPrice:      totalPrice      ? Number(totalPrice)        : undefined,
          channel,
          expiryDate:      expiryDate      ? new Date(expiryDate)      : undefined,
          manufactureDate: manufactureDate ? new Date(manufactureDate) : undefined,
          openedDate:      openedDate      ? new Date(openedDate)      : undefined,
          paoMonths:       paoMonths       ? Number(paoMonths)         : undefined,
          notes,
        },
      })

      // Sync the linked stock IN log if quantity or channel changed
      if (quantity !== undefined || channel !== undefined) {
        await tx.stockLog.updateMany({
          where: { purchaseRecordId: purchaseId },
          data: {
            ...(quantity !== undefined ? { quantity: Number(quantity) } : {}),
            ...(channel !== undefined ? { reason: `購買入庫 — ${channel ?? ''}` } : {}),
          },
        })
      }
    })

    res.json({ message: '更新成功' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/purchases/:id
router.delete('/:id', authenticate, writeRateLimit, async (req: AuthRequest, res, next) => {
  try {
    const purchaseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    // Verify ownership
    const existing = await prisma.purchaseRecord.findFirst({
      where: { id: purchaseId, product: { userId: req.user!.userId } },
    })
    if (!existing) { res.status(404).json({ message: '找不到此購買紀錄' }); return }

    // Nullify the link on the stock log before deleting (cascade SetNull handles FK,
    // but we explicitly delete the linked IN log to keep stock accurate)
    await prisma.$transaction(async (tx) => {
      await tx.stockLog.deleteMany({ where: { purchaseRecordId: purchaseId } })
      await tx.purchaseRecord.delete({ where: { id: purchaseId } })
    })

    res.json({ message: '已刪除' })
  } catch (err) {
    next(err)
  }
})

export default router
