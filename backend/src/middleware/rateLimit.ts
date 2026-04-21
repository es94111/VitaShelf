import type { RequestHandler } from 'express'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const getClientIp = (ip: string | undefined): string => ip || 'unknown'

export const createRateLimit = (windowMs: number, maxRequests: number): RequestHandler => {
  return (req, res, next) => {
    const now = Date.now()
    const userId = (req as { user?: { userId?: string } }).user?.userId ?? 'anonymous'
    const key = `${userId}:${getClientIp(req.ip)}`

    const bucket = buckets.get(key)

    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(retryAfterSeconds))
      res.status(429).json({ message: '請稍後再試' })
      return
    }

    bucket.count += 1
    next()
  }
}

// ── Preset limiters (per-user + per-IP, 1 minute window) ─────────────────────
// Applied at route level to satisfy CodeQL js/missing-rate-limiting and mitigate
// brute-force / scraping abuse. Adjust thresholds if legitimate usage grows.

/** Read endpoints: GET list / detail / dashboard stats. */
export const readRateLimit = createRateLimit(60 * 1000, 120)

/** Mutation endpoints: POST / PUT / DELETE / PATCH on normal resources. */
export const writeRateLimit = createRateLimit(60 * 1000, 30)

/** Auth endpoints: login, Google SSO — stricter to slow brute force. */
export const authRateLimit = createRateLimit(60 * 1000, 10)

/** Heavy endpoints: CSV import / export — small batch to protect DB / CPU. */
export const heavyRateLimit = createRateLimit(60 * 1000, 10)
