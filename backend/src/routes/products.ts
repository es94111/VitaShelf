import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { addDays, isPast } from 'date-fns'

const router = Router()
const prisma = new PrismaClient()

function getAlertLevel(expiryDate: Date | null): string {
  if (!expiryDate) return 'ok'
  if (isPast(expiryDate)) return 'expired'
  if (isPast(addDays(expiryDate, -7))) return 'danger'
  if (isPast(addDays(expiryDate, -30))) return 'warn'
  return 'ok'
}

// GET /api/products
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { search = '', category, page = '1', pageSize = '20', sortBy = 'createdAt', sortDir = 'desc' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(pageSize)

    const where = {
      userId: req.user!.userId,
      isDeleted: false,
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { brand: { contains: search, mode: 'insensitive' as const } }] } : {}),
      ...(category ? { category: category.toUpperCase() as 'SKINCARE' | 'SUPPLEMENT' } : {}),
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { tags: { include: { tag: true } }, purchases: { select: { expiryDate: true } } },
        orderBy: { [sortBy]: sortDir },
        skip,
        take: Number(pageSize),
      }),
      prisma.product.count({ where }),
    ])

    const data = products.map((p) => {
      const nextExpiry = p.purchases.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())[0]?.expiryDate ?? null
      const stockIn  = 0  // computed from stockLogs in full implementation
      return {
        ...p,
        category: p.category.toLowerCase(),
        tags: p.tags.map((pt) => pt.tag),
        purchases: undefined,
        currentStock: stockIn,
        alertLevel: getAlertLevel(nextExpiry),
      }
    })

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) })
  } catch (err) {
    next(err)
  }
})

// GET /api/products/:id
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: { tags: { include: { tag: true } }, purchases: true, stockLogs: { orderBy: { createdAt: 'desc' }, take: 20 } },
    })
    if (!product) { res.status(404).json({ message: '找不到此產品' }); return }
    res.json(product)
  } catch (err) {
    next(err)
  }
})

// POST /api/products
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, brand, category, subCategory, spec, barcode, notes, tagIds } = req.body
    const product = await prisma.product.create({
      data: {
        name, brand,
        category: category.toUpperCase(),
        subCategory, spec, barcode, notes,
        userId: req.user!.userId,
        tags: tagIds?.length ? { create: tagIds.map((id: string) => ({ tag: { connect: { id } } })) } : undefined,
      },
    })
    res.status(201).json(product)
  } catch (err) {
    next(err)
  }
})

// PUT /api/products/:id
router.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, brand, category, subCategory, spec, barcode, notes } = req.body
    const product = await prisma.product.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { name, brand, category: category?.toUpperCase(), subCategory, spec, barcode, notes },
    })
    if (!product.count) { res.status(404).json({ message: '找不到此產品' }); return }
    res.json({ message: '更新成功' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/products/:id  (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await prisma.product.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { isDeleted: true },
    })
    if (!result.count) { res.status(404).json({ message: '找不到此產品' }); return }
    res.json({ message: '已刪除' })
  } catch (err) {
    next(err)
  }
})

// POST /api/products/:id/restore
router.post('/:id/restore', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.product.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { isDeleted: false },
    })
    res.json({ message: '已還原' })
  } catch (err) {
    next(err)
  }
})

export default router
