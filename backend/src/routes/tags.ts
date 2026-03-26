import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json(await prisma.tag.findMany({ where: { userId: req.user!.userId } }))
  } catch (err) { next(err) }
})

router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, color } = req.body
    const tag = await prisma.tag.create({ data: { name, color: color ?? '#64748B', userId: req.user!.userId } })
    res.status(201).json(tag)
  } catch (err) { next(err) }
})

router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.tag.deleteMany({ where: { id: req.params.id, userId: req.user!.userId } })
    res.json({ message: '已刪除' })
  } catch (err) { next(err) }
})

export default router
