import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('displayName').trim().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ message: '輸入資料有誤', errors: errors.array() })
        return
      }

      const { email, password, displayName } = req.body
      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists) {
        res.status(409).json({ message: '此電子郵件已被使用' })
        return
      }

      const hashed = await bcrypt.hash(password, 12)
      const user = await prisma.user.create({
        data: { email, password: hashed, displayName },
        select: { id: true, email: true, displayName: true, role: true },
      })

      res.status(201).json({ user })
    } catch (err) {
      next(err)
    }
  },
)

// POST /api/auth/login
router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  async (req, res, next) => {
    try {
      const { email, password } = req.body
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user || !(await bcrypt.compare(password, user.password))) {
        res.status(401).json({ message: '電子郵件或密碼不正確' })
        return
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' },
      )

      res.json({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName },
      })
    } catch (err) {
      next(err)
    }
  },
)

// POST /api/auth/logout — client-side token deletion; endpoint for future blocklist
router.post('/logout', (_req, res) => {
  res.json({ message: '已成功登出' })
})

// GET /api/users/me
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, displayName: true, role: true, createdAt: true },
    })
    res.json(user)
  } catch (err) {
    next(err)
  }
})

export default router
