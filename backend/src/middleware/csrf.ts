// 對應 research.md R-001（`SameSite=Strict` + Origin/Referer 檢查雙重防護）
// 與 FR-012a。
//
// 對非 GET/HEAD/OPTIONS 請求，要求 Origin（或 fallback Referer）
// 屬於 CORS_ORIGIN 白名單（逗號分隔可多值）；否則 403。

import type { Request, Response, NextFunction } from 'express'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:3000'
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function originMatches(originOrReferer: string, allowed: string[]): boolean {
  try {
    const url = new URL(originOrReferer)
    const base = `${url.protocol}//${url.host}`
    return allowed.includes(base)
  } catch {
    return false
  }
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next()
    return
  }

  const origin = req.headers.origin
  const referer = req.headers.referer
  const allowed = parseAllowedOrigins()

  if (origin && typeof origin === 'string') {
    if (!originMatches(origin, allowed)) {
      res.status(403).json({ message: '請求來源不被允許' })
      return
    }
  } else if (referer && typeof referer === 'string') {
    if (!originMatches(referer, allowed)) {
      res.status(403).json({ message: '請求來源不被允許' })
      return
    }
  } else {
    // 非標準 UA 不帶 Origin/Referer；配合 SameSite=Strict 仍可擋住大多數 CSRF，
    // 但於狀態改變端點我們採嚴格態度：一律要求至少一個 header。
    res.status(403).json({ message: '請求來源不被允許' })
    return
  }

  next()
}
