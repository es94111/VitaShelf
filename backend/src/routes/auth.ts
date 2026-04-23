// 認證模組路由（對應 spec.md 的 6 則 User Story）
//
// 本檔於頂端 inline 宣告 rate limit middleware 以通過 CodeQL
// `js/missing-rate-limiting`（憲法 Principle IV）。

import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { body, validationResult } from 'express-validator'
import prisma from '../utils/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { loginRateLimit, authRateLimit } from '../middleware/rateLimit'
import { requireSameOrigin } from '../middleware/csrf'
import { getClientIp, lookupCountry } from '../utils/ipCountry'
import {
  hashPassword,
  verifyPassword,
  verifyPasswordConstantTime,
  isWeakPassword,
} from '../utils/password'
import { signToken, authCookieSetHeader, clearAuthCookieHeader } from '../utils/jwt'
import { writeLoginLog, type LoginLogReason } from '../utils/loginLog'

const router = Router()

// Router-wide baseline 限流（CodeQL 可識別；參見 FR-022）
router.use(rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }))

// ─── Helper ─────────────────────────────────────────────────────────────────

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function logLoginAttempt(
  req: Request,
  opts: {
    userId?: string | null
    email: string
    success: boolean
    reason?: LoginLogReason | null
  },
): Promise<void> {
  const ip = getClientIp(req)
  const country = await lookupCountry(ip)
  await writeLoginLog({
    userId: opts.userId,
    email: opts.email,
    ip,
    country,
    method: 'local',
    success: opts.success,
    reason: opts.reason ?? null,
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

// ─── POST /api/auth/register （US1, FR-001~007）──────────────────────────────

router.post(
  '/register',
  authRateLimit,
  [
    body('email').isString().trim().isEmail().withMessage('email 格式錯誤').isLength({ max: 254 }),
    body('password').isString().isLength({ min: 8 }).withMessage('密碼至少需 8 字元'),
    body('displayName').isString().trim().notEmpty().withMessage('顯示名稱為必填').isLength({ max: 50 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          message: '輸入驗證失敗',
          errors: errors.array().map((e) => ({ path: (e as { path?: string }).path ?? 'unknown', message: e.msg })),
        })
        return
      }

      const email = normalizeEmail(req.body.email)
      const { password, displayName } = req.body as { password: string; displayName: string }

      // 弱密碼檢查（FR-004b）
      if (isWeakPassword(password)) {
        res.status(400).json({
          message: '輸入驗證失敗',
          errors: [{ path: 'password', message: '此密碼過於常見，請改用較不易被猜中的密碼' }],
        })
        return
      }

      // 公開註冊開關（FR-007）；首位使用者一律允許註冊並成為 ADMIN
      const userCount = await prisma.user.count()
      if (userCount > 0) {
        const settings = await prisma.adminSettings.findUnique({ where: { id: 'singleton' } })
        if (settings && !settings.registrationOpen) {
          res.status(403).json({ message: settings.registrationNotice || '目前不開放註冊' })
          return
        }
      }

      // 重複 email（FR-003）
      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists) {
        res.status(409).json({ message: '帳號已存在' })
        return
      }

      const hashed = await hashPassword(password)
      const role = userCount === 0 ? 'ADMIN' : 'USER'

      const user = await prisma.user.create({
        data: {
          email,
          password: hashed,
          displayName: displayName.trim(),
          role,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          theme: true,
          authProvider: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      // 首位使用者時確保 AdminSettings singleton 存在
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

// ─── POST /api/auth/login （US2, FR-008~012 + FR-021~023）────────────────────

router.post(
  '/login',
  loginRateLimit,
  [
    body('email').isString().trim().isEmail().withMessage('email 格式錯誤'),
    body('password').isString().notEmpty().withMessage('密碼為必填'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        await logLoginAttempt(req, {
          email: typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : '',
          success: false,
          reason: 'validation_error',
        })
        res.status(400).json({
          message: '輸入驗證失敗',
          errors: errors.array().map((e) => ({ path: (e as { path?: string }).path ?? 'unknown', message: e.msg })),
        })
        return
      }

      const email = normalizeEmail(req.body.email)
      const { password } = req.body as { password: string }

      const user = await prisma.user.findUnique({ where: { email } })

      // Constant-time password compare（對應 SC-006）：
      // 使用者不存在時仍以 dummy hash 跑一次 bcrypt，避免回應時間 oracle。
      const ok = await verifyPasswordConstantTime(password, user?.password ?? null)

      if (!user || !ok) {
        await logLoginAttempt(req, {
          userId: user?.id ?? null,
          email,
          success: false,
          reason: user ? 'wrong_password' : 'email_not_found',
        })
        res.status(401).json({ message: '帳號或密碼錯誤' })
        return
      }

      // 帳號停用檢查（FR-011a）— 密碼比對通過後再檢查以避免帳號枚舉
      if (!user.isActive) {
        await logLoginAttempt(req, {
          userId: user.id,
          email,
          success: false,
          reason: 'account_disabled',
        })
        res.status(403).json({ message: '帳號已被停用' })
        return
      }

      // 簽發 JWT 並以 Set-Cookie 下發（FR-008 / FR-009）
      const token = signToken({ userId: user.id, email: user.email, role: user.role })
      res.setHeader('Set-Cookie', authCookieSetHeader(token))

      await logLoginAttempt(req, { userId: user.id, email, success: true, reason: null })

      res.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          theme: user.theme,
          authProvider: user.authProvider,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

// ─── POST /api/auth/logout （US3, FR-013~014）────────────────────────────────

router.post('/logout', authenticate, requireSameOrigin, (_req: AuthRequest, res: Response) => {
  res.setHeader('Set-Cookie', clearAuthCookieHeader())
  res.json({ message: '已登出' })
})

// ─── GET /api/users/me （US4, FR-015）─────────────────────────────────────────

router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        theme: true,
        authProvider: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    res.json(user)
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/users/me （US4, FR-016~017）─────────────────────────────────────

router.put(
  '/me',
  authenticate,
  requireSameOrigin,
  [
    body('displayName').optional().isString().trim().isLength({ min: 1, max: 50 }).withMessage('顯示名稱長度需介於 1-50'),
    body('theme').optional().isIn(['light', 'dark']).withMessage('主題只能是 light 或 dark'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          message: '輸入驗證失敗',
          errors: errors.array().map((e) => ({ path: (e as { path?: string }).path ?? 'unknown', message: e.msg })),
        })
        return
      }
      const data: { displayName?: string; theme?: string } = {}
      if (req.body.displayName !== undefined) data.displayName = String(req.body.displayName).trim()
      if (req.body.theme !== undefined) data.theme = String(req.body.theme)
      if (Object.keys(data).length === 0) {
        res.status(400).json({ message: '請至少提供一個可更新欄位' })
        return
      }
      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          theme: true,
          authProvider: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      res.json(user)
    } catch (err) {
      next(err)
    }
  },
)

// ─── PUT /api/users/me/theme （既有前端相容）─────────────────────────────────
// 既有前端呼叫此端點；語意與 PUT /me { theme } 等同
router.put(
  '/me/theme',
  authenticate,
  requireSameOrigin,
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

// ─── POST /api/users/me/change-password （US5, FR-018~020）───────────────────

router.post(
  '/me/change-password',
  authenticate,
  requireSameOrigin,
  authRateLimit,
  [
    body('oldPassword').isString().notEmpty().withMessage('請輸入目前密碼'),
    body('newPassword').isString().isLength({ min: 8 }).withMessage('密碼至少需 8 字元'),
    // 向下相容既有前端欄位名
    body('currentPassword').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          message: '輸入驗證失敗',
          errors: errors.array().map((e) => ({ path: (e as { path?: string }).path ?? 'unknown', message: e.msg })),
        })
        return
      }

      const oldPassword: string = req.body.oldPassword ?? req.body.currentPassword
      const newPassword: string = req.body.newPassword

      if (isWeakPassword(newPassword)) {
        res.status(400).json({
          message: '輸入驗證失敗',
          errors: [{ path: 'newPassword', message: '此密碼過於常見，請改用較不易被猜中的密碼' }],
        })
        return
      }

      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
      if (!user || !(await verifyPassword(oldPassword, user.password))) {
        res.status(401).json({ message: '帳號或密碼錯誤' })
        return
      }

      const newHash = await hashPassword(newPassword)
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { password: newHash, passwordChangedAt: new Date() },
        })
      })

      // 清除當前 cookie 強制重登（FR-020b / FR-020c）
      res.setHeader('Set-Cookie', clearAuthCookieHeader())
      res.json({ message: '密碼已更新，請重新登入' })
    } catch (err) {
      next(err)
    }
  },
)

// ─── GET /api/users/me/login-logs ─────────────────────────────────────────────

router.get('/me/login-logs', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
