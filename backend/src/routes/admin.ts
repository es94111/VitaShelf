import { Router, type Response, type NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../utils/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

// ─── Middleware: require ADMIN role ─────────────────────────────────────────

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ message: '需要管理員權限' })
    return
  }
  next()
}

router.use(authenticate, requireAdmin)

// ─── GET /api/admin/settings — registration policy ──────────────────────────

router.get('/settings', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let settings = await prisma.adminSettings.findUnique({ where: { id: 'singleton' } })
    if (!settings) {
      settings = await prisma.adminSettings.create({
        data: { id: 'singleton', registrationOpen: true },
      })
    }
    res.json(settings)
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/admin/settings — update registration policy ───────────────────

router.put(
  '/settings',
  [
    body('registrationOpen').isBoolean().withMessage('registrationOpen 必須是布林值'),
    body('registrationNotice').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0].msg })
        return
      }

      const settings = await prisma.adminSettings.upsert({
        where: { id: 'singleton' },
        update: {
          registrationOpen: req.body.registrationOpen,
          registrationNotice: req.body.registrationNotice ?? '',
        },
        create: {
          id: 'singleton',
          registrationOpen: req.body.registrationOpen,
          registrationNotice: req.body.registrationNotice ?? '',
        },
      })
      res.json(settings)
    } catch (err) {
      next(err)
    }
  },
)

// ─── GET /api/admin/users — list all users ──────────────────────────────────

router.get('/users', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        authProvider: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json(users)
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/admin/users/:id/role — change user role ───────────────────────

router.put(
  '/users/:id/role',
  [body('role').isIn(['ADMIN', 'USER', 'VIEWER']).withMessage('角色只能是 ADMIN、USER 或 VIEWER')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0].msg })
        return
      }

      const user = await prisma.user.update({
        where: { id: req.params.id as string },
        data: { role: req.body.role },
        select: { id: true, email: true, displayName: true, role: true },
      })
      res.json(user)
    } catch (err) {
      next(err)
    }
  },
)

// ─── DELETE /api/admin/users/:id — delete user ──────────────────────────────

router.delete('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.userId) {
      res.status(400).json({ message: '不能刪除自己的帳號' })
      return
    }
    await prisma.user.delete({ where: { id: req.params.id as string } })
    res.json({ message: '使用者已刪除' })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/admin/login-logs — all login logs (admin view) ────────────────

router.get('/login-logs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (req.query.userId) where.userId = req.query.userId as string
    if (req.query.success !== undefined) where.success = req.query.success === 'true'

    const [data, total] = await Promise.all([
      prisma.loginLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { user: { select: { displayName: true, email: true } } },
      }),
      prisma.loginLog.count({ where }),
    ])

    res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/admin/login-logs/:id — delete single login log ─────────────

router.delete('/login-logs/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.loginLog.delete({ where: { id: req.params.id as string } })
    res.json({ message: '紀錄已刪除' })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/admin/login-logs/batch-delete — batch delete login logs ──────

router.post('/login-logs/batch-delete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ message: '請提供要刪除的紀錄 ID' })
      return
    }

    // Try batch delete first
    try {
      const result = await prisma.loginLog.deleteMany({
        where: { id: { in: ids } },
      })
      res.json({ deleted: result.count, message: `已刪除 ${result.count} 筆紀錄` })
      return
    } catch {
      // Fallback: delete one-by-one
      let deleted = 0
      const errors: string[] = []

      for (const id of ids) {
        try {
          await prisma.loginLog.delete({ where: { id } })
          deleted++
        } catch {
          errors.push(id)
        }
      }

      res.json({
        deleted,
        failed: errors.length,
        errors,
        message: `已刪除 ${deleted} 筆紀錄${errors.length > 0 ? `，${errors.length} 筆失敗` : ''}`,
      })
    }
  } catch (err) {
    next(err)
  }
})

export default router
