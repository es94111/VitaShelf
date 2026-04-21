import rateLimit, { type Options } from 'express-rate-limit'
import type { RequestHandler, Request } from 'express'

/**
 * Rate limiting — backed by `express-rate-limit` so CodeQL's
 * `js/missing-rate-limiting` query recognises the middleware.
 *
 * Bucketed per authenticated user when available, otherwise per-IP.
 * 1-minute fixed window.
 */

const keyByUserOrIp = (req: Request): string => {
  const userId = (req as { user?: { userId?: string } }).user?.userId
  if (userId) return `u:${userId}`
  return `ip:${req.ip ?? 'unknown'}`
}

const buildLimiter = (max: number): RequestHandler =>
  rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    handler: (_req, res) => {
      res.status(429).json({ message: '請稍後再試' })
    },
  } satisfies Partial<Options>)

/** Back-compat factory for callers that need a custom window / max. */
export const createRateLimit = (windowMs: number, max: number): RequestHandler =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    handler: (_req, res) => {
      res.status(429).json({ message: '請稍後再試' })
    },
  } satisfies Partial<Options>)

// ── Preset limiters (per-user + per-IP, 1 minute window) ─────────────────────

/** Read endpoints: GET list / detail / dashboard stats. */
export const readRateLimit = buildLimiter(120)

/** Mutation endpoints: POST / PUT / DELETE / PATCH on normal resources. */
export const writeRateLimit = buildLimiter(30)

/** Auth endpoints: login, Google SSO — stricter to slow brute force. */
export const authRateLimit = buildLimiter(10)

/** Heavy endpoints: CSV import / export — small batch to protect DB / CPU. */
export const heavyRateLimit = buildLimiter(10)
