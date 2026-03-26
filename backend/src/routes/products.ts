import { Router } from 'express'
import prisma from '../utils/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { handleUpload } from '../utils/upload'
import { computeStockFromLogs, getAlertLevel, getNearestExpiry } from '../utils/stock'

const router = Router()

// GET /api/products
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const {
      search    = '',
      category,
      tag,
      page      = '1',
      pageSize  = '20',
      sortBy    = 'createdAt',
      sortDir   = 'desc',
      deleted   = 'false',
    } = req.query as Record<string, string>

    const skip = (Number(page) - 1) * Number(pageSize)
    const showDeleted = deleted === 'true'

    const where = {
      userId:    req.user!.userId,
      isDeleted: showDeleted,
      ...(search
        ? {
            OR: [
              { name:  { contains: search, mode: 'insensitive' as const } },
              { brand: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(category ? { category: category.toUpperCase() as 'SKINCARE' | 'SUPPLEMENT' } : {}),
      ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          tags:      { include: { tag: true } },
          purchases: { select: { expiryDate: true }, orderBy: { expiryDate: 'asc' }, take: 1 },
          stockLogs: { select: { type: true, quantity: true } },
        },
        orderBy: { [sortBy]: sortDir },
        skip,
        take: Number(pageSize),
      }),
      prisma.product.count({ where }),
    ])

    const data = products.map((p) => ({
      id:          p.id,
      name:        p.name,
      brand:       p.brand,
      category:    p.category.toLowerCase(),
      subCategory: p.subCategory,
      spec:        p.spec,
      barcode:     p.barcode,
      imageUrl:    p.imageUrl,
      notes:       p.notes,
      isDeleted:   p.isDeleted,
      createdAt:   p.createdAt,
      updatedAt:   p.updatedAt,
      tags:        p.tags.map((pt) => pt.tag),
      currentStock: computeStockFromLogs(p.stockLogs),
      alertLevel:   getAlertLevel(p.purchases[0]?.expiryDate ?? null),
    }))

    res.json({
      data,
      total,
      page:        Number(page),
      pageSize:    Number(pageSize),
      totalPages:  Math.ceil(total / Number(pageSize)),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/products/:id
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user!.userId },
      include: {
        tags:      { include: { tag: true } },
        purchases: { orderBy: { purchaseDate: 'desc' } },
        stockLogs: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    })

    if (!product) {
      res.status(404).json({ message: '找不到此產品' })
      return
    }

    const nearestExpiry = product.purchases
      .map((p) => p.expiryDate)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null

    res.json({
      ...product,
      category:     product.category.toLowerCase(),
      tags:         product.tags.map((pt) => pt.tag),
      currentStock: computeStockFromLogs(product.stockLogs),
      alertLevel:   getAlertLevel(nearestExpiry),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/products
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await handleUpload(req, res)

    const { name, brand, category, subCategory, spec, barcode, notes, tagIds } = req.body
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined

    if (!name || !brand || !category) {
      res.status(400).json({ message: '名稱、品牌、分類為必填欄位' })
      return
    }

    const tagIdsArr: string[] = tagIds
      ? Array.isArray(tagIds) ? tagIds : [tagIds]
      : []

    const product = await prisma.product.create({
      data: {
        name,
        brand,
        category: (category as string).toUpperCase() as 'SKINCARE' | 'SUPPLEMENT',
        subCategory,
        spec,
        barcode,
        imageUrl,
        notes,
        userId: req.user!.userId,
        tags: tagIdsArr.length
          ? { create: tagIdsArr.map((id) => ({ tag: { connect: { id } } })) }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    })

    res.status(201).json({
      ...product,
      category:     product.category.toLowerCase(),
      tags:         product.tags.map((pt) => pt.tag),
      currentStock: 0,
      alertLevel:   'ok',
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/products/:id
router.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    await handleUpload(req, res)

    const { name, brand, category, subCategory, spec, barcode, notes, tagIds } = req.body
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined

    // Verify ownership
    const existing = await prisma.product.findFirst({
      where: { id: productId, userId: req.user!.userId },
    })
    if (!existing) {
      res.status(404).json({ message: '找不到此產品' })
      return
    }

    // Replace tag associations
    const tagIdsArr: string[] = tagIds
      ? Array.isArray(tagIds) ? tagIds : [tagIds]
      : []

    await prisma.productTag.deleteMany({ where: { productId } })

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(name        ? { name }                                              : {}),
        ...(brand       ? { brand }                                             : {}),
        ...(category    ? { category: (category as string).toUpperCase() as 'SKINCARE' | 'SUPPLEMENT' } : {}),
        ...(subCategory !== undefined ? { subCategory }                         : {}),
        ...(spec        !== undefined ? { spec }                                : {}),
        ...(barcode     !== undefined ? { barcode }                             : {}),
        ...(notes       !== undefined ? { notes }                               : {}),
        ...(imageUrl                  ? { imageUrl }                            : {}),
        tags: tagIdsArr.length
          ? { create: tagIdsArr.map((id) => ({ tag: { connect: { id } } })) }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    })

    const nearestExpiry = await getNearestExpiry(productId)

    res.json({
      ...product,
      category:     product.category.toLowerCase(),
      tags:         product.tags.map((pt) => pt.tag),
      currentStock: computeStockFromLogs([]),  // caller should refresh stock separately
      alertLevel:   getAlertLevel(nearestExpiry),
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/products/:id  (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    const result = await prisma.product.updateMany({
      where: { id: productId, userId: req.user!.userId },
      data:  { isDeleted: true },
    })
    if (!result.count) {
      res.status(404).json({ message: '找不到此產品' })
      return
    }
    res.json({ message: '已刪除' })
  } catch (err) {
    next(err)
  }
})

// POST /api/products/:id/restore
router.post('/:id/restore', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    const result = await prisma.product.updateMany({
      where: { id: productId, userId: req.user!.userId },
      data:  { isDeleted: false },
    })
    if (!result.count) {
      res.status(404).json({ message: '找不到此產品' })
      return
    }
    res.json({ message: '已還原' })
  } catch (err) {
    next(err)
  }
})

export default router
