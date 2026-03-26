import { Router, type Request, type Response, type NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../utils/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { getClientIp, lookupCountry } from '../utils/ipCountry'

const router = Router()

// ─── Helper: log login attempt ──────────────────────────────────────────────

async function logLogin(
  req: Request,
  opts: { userId?: string; email: string; success: boolean; method?: string; reason?: string },
) {
  const ip = getClientIp(req)
  // Lookup country in background — don't block the response
  lookupCountry(ip).then((country) => {
    prisma.loginLog
      .create({
        data: {
          userId: opts.userId ?? null,
          email: opts.email,
          ip,
          country,
          method: opts.method ?? 'local',
          success: opts.success,
          reason: opts.reason ?? null,
        },
      })
      .catch((err) => console.error('[LoginLog] Failed to write:', err))
  })
}

// ─── GET /api/auth/registration-status ──────────────────────────────────────

router.get('/registration-status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.adminSettings.findUnique({ where: { id: 'singleton' } })
    const userCount = await prisma.user.count()
    res.json({
      open: settings?.registrationOpen ?? true,
      notice: settings?.registrationNotice ?? '',
      hasUsers: userCount > 0,
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/auth/register ────────────────────────────────────────────────

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('displayName').trim().notEmpty(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ message: '輸入資料有誤', errors: errors.array() })
        return
      }

      // Check registration policy
      const settings = await prisma.adminSettings.findUnique({ where: { id: 'singleton' } })
      const userCount = await prisma.user.count()

      // If not the first user, check if registration is open
      if (userCount > 0 && settings && !settings.registrationOpen) {
        res.status(403).json({ message: settings.registrationNotice || '目前不開放註冊' })
        return
      }

      const { email, password, displayName } = req.body
      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists) {
        res.status(409).json({ message: '此電子郵件已被使用' })
        return
      }

      const hashed = await bcrypt.hash(password, 12)

      // First user becomes ADMIN
      const role = userCount === 0 ? 'ADMIN' : 'USER'

      const user = await prisma.user.create({
        data: { email, password: hashed, displayName, role },
        select: { id: true, email: true, displayName: true, role: true },
      })

      // Ensure AdminSettings singleton exists
      if (userCount === 0) {
        await prisma.adminSettings.upsert({
          where: { id: 'singleton' },
          update: {},
          create: { id: 'singleton', registrationOpen: true },
        })
      }

      res.status(201).json({ user })
    } catch (err) {
      next(err)
    }
  },
)

// ─── POST /api/auth/login ───────────────────────────────────────────────────

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body
      const user = await prisma.user.findUnique({ where: { email } })

      if (!user || !(await bcrypt.compare(password, user.password))) {
        logLogin(req, { email, success: false, reason: '帳號或密碼不正確' })
        res.status(401).json({ message: '電子郵件或密碼不正確' })
        return
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' },
      )

      logLogin(req, { userId: user.id, email, success: true })

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          theme: user.theme,
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

// ─── POST /api/auth/logout ──────────────────────────────────────────────────

router.post('/logout', (_req, res) => {
  res.json({ message: '已成功登出' })
})

// ─── GET /api/users/me ──────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, displayName: true, role: true, theme: true, createdAt: true },
    })
    res.json(user)
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/users/me — update display name ────────────────────────────────

router.put(
  '/me',
  authenticate,
  [body('displayName').trim().notEmpty().withMessage('顯示名稱不得為空')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0].msg })
        return
      }
      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: { displayName: req.body.displayName },
        select: { id: true, email: true, displayName: true, role: true, theme: true },
      })
      res.json(user)
    } catch (err) {
      next(err)
    }
  },
)

// ─── PUT /api/users/me/theme ────────────────────────────────────────────────

router.put(
  '/me/theme',
  authenticate,
  [body('theme').isIn(['light', 'dark']).withMessage('主題只能是 light 或 dark')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0].msg })
        return
      }
      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: { theme: req.body.theme },
        select: { id: true, theme: true },
      })
      res.json(user)
    } catch (err) {
      next(err)
    }
  },
)

// ─── POST /api/users/me/change-password ─────────────────────────────────────

router.post(
  '/me/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('請輸入目前密碼'),
    body('newPassword').isLength({ min: 8 }).withMessage('新密碼至少 8 個字元'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0].msg })
        return
      }

      const { currentPassword, newPassword } = req.body
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        res.status(400).json({ message: '目前密碼不正確' })
        return
      }

      const hashed = await bcrypt.hash(newPassword, 12)
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { password: hashed },
      })
      res.json({ message: '密碼已更新' })
    } catch (err) {
      next(err)
    }
  },
)

// ─── GET /api/users/me/login-logs — user's own login logs ───────────────────

router.get('/me/login-logs', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const skip = (page - 1) * pageSize

    const [data, total] = await Promise.all([
      prisma.loginLog.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.loginLog.count({ where: { userId: req.user!.userId } }),
    ])

    res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (err) {
    next(err)
  }
})

export default router
