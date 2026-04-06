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
