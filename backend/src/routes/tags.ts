import { Router } from 'express'
import prisma from '../utils/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/tags — list with product count
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId: req.user!.userId },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    })
    const result = tags.map((t) => ({
      id:           t.id,
      name:         t.name,
      color:        t.color,
      productCount: t._count.products,
    }))
    res.json(result)
  } catch (err) { next(err) }
})

// POST /api/tags
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, color } = req.body
    if (!name?.trim()) {
      res.status(400).json({ message: '標籤名稱不得為空' })
      return
    }
    const tag = await prisma.tag.create({
      data: { name: name.trim(), color: color ?? '#64748B', userId: req.user!.userId },
    })
    res.status(201).json({ ...tag, productCount: 0 })
  } catch (err) { next(err) }
})

// PUT /api/tags/:id
router.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tagId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    const { name, color } = req.body
    if (!name?.trim()) {
      res.status(400).json({ message: '標籤名稱不得為空' })
      return
    }
    const tag = await prisma.tag.updateMany({
      where: { id: tagId, userId: req.user!.userId },
      data:  { name: name.trim(), color },
    })
    if (tag.count === 0) {
      res.status(404).json({ message: '找不到此標籤' })
      return
    }
    const updated = await prisma.tag.findUnique({
      where: { id: tagId },
      include: { _count: { select: { products: true } } },
    })
    res.json({ ...updated, productCount: updated!._count.products })
  } catch (err) { next(err) }
})

// DELETE /api/tags/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tagId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    await prisma.tag.deleteMany({ where: { id: tagId, userId: req.user!.userId } })
    res.json({ message: '已刪除' })
  } catch (err) { next(err) }
})

export default router
