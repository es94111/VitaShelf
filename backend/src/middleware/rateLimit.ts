import rateLimit from 'express-rate-limit'
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
  return `ip:${req.ip ?? 'unknown'}`
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
