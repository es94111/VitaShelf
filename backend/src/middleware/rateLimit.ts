import rateLimit, { MemoryStore, ipKeyGenerator } from 'express-rate-limit'
import type { RequestHandler, Request } from 'express'

/**
 * Rate limiting — backed by `express-rate-limit` so CodeQL's
 * `js/missing-rate-limiting` query recognises the middleware.
 *
 * Bucketed per authenticated user when available, otherwise per-IP.
 * 1-minute fixed window.
 *
 * NOTE: each preset is a direct call to `rateLimit({...})` (not wrapped in a
 * helper) so CodeQL's data-flow analysis can see the call site.
 */

const keyByUserOrIp = (req: Request): string => {
  const userId = (req as { user?: { userId?: string } }).user?.userId
  if (userId) return `u:${userId}`
  return `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`
}

const tooManyRequests: RequestHandler = (_req, res) => {
  res.status(429).json({ message: '請稍後再試' })
}

/** Read endpoints: GET list / detail / dashboard stats. */
export const readRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  handler: tooManyRequests,
})

/** Mutation endpoints: POST / PUT / DELETE / PATCH on normal resources. */
export const writeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  handler: tooManyRequests,
})

/** Auth endpoints: login, Google SSO — stricter to slow brute force. */
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  handler: tooManyRequests,
})

/** Login endpoint（對應 FR-021/022/023 + FR-023a/b/c）：
 *  每 IP / 分鐘最多 5 次失敗；回應夾帶 Retry-After header + body 的
 *  retryAfterSeconds；成功登入不計入失敗次數。 */
export const loginRateLimitStore = new MemoryStore()
export const loginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login-ip:${ipKeyGenerator(req.ip ?? 'unknown')}`,  // 以 IP 為維度（FR-023）
  store: loginRateLimitStore,
  handler: (req, res) => {
    const rl = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit
    const resetTime = rl?.resetTime
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : 60
    res.setHeader('Retry-After', String(retryAfterSeconds))
    res.status(429).json({
      message: '登入嘗試次數過多，請稍後再試',
      retryAfterSeconds,
    })
  },
})

/** Heavy endpoints: CSV import / export — small batch to protect DB / CPU. */
export const heavyRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  handler: tooManyRequests,
})

/** Global baseline — applied via `app.use` in index.ts. */
export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  handler: tooManyRequests,
})

/** Back-compat factory for callers needing a custom window / max. */
export const createRateLimit = (windowMs: number, max: number): RequestHandler =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    handler: tooManyRequests,
  })
