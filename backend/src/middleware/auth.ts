// 對應 FR-012 / FR-012b 與 data-model.md §4.2。
//
// 優先從 cookie 讀 JWT（FR-012 新規範）；為保留既有前端相容，
// 若 cookie 不存在則 fallback 至 Authorization: Bearer header。
// 驗證 JWT 後讀取 User、比對 jwt.iat >= user.passwordChangedAt（± 60 秒時鐘偏差），
// 以達到「密碼變更後所有裝置下次請求即失效」的全裝置吊銷語意（FR-020c）。

import type { Request, Response, NextFunction } from 'express'
import prisma from '../utils/prisma.js'
import { verifyToken, COOKIE_NAME, type JwtPayload } from '../utils/jwt.js'

export type { JwtPayload }

export interface AuthRequest extends Request {
  user?: JwtPayload
}

function extractToken(req: Request): string | null {
  // 優先 cookie（FR-012）
  // Express 5 cookie-parser 會把 cookies 填入 req.cookies；若未掛 cookie-parser，
  // 則 req.cookies 為 undefined。這裡做防禦式讀取。
  const cookies = (req as Request & { cookies?: Record<string, string | undefined> }).cookies
  const cookieToken = cookies?.[COOKIE_NAME]
  if (cookieToken) return cookieToken

  // 向下相容：Authorization header（既有前端尚未切換至 cookie 時）
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)

  return null
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req)
  if (!token) {
    res.status(401).json({ message: '未授權，請先登入' })
    return
  }

  let payload: JwtPayload
  try {
    payload = verifyToken(token)
  } catch {
    res.status(401).json({ message: '憑證已失效，請重新登入' })
    return
  }

  // passwordChangedAt 比對（FR-012b）
  // 每次請求做一次主鍵查詢；SQLite 主鍵 O(log n)，此量級 < 1 ms（R-004）。
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, passwordChangedAt: true, isActive: true },
    })
    if (!user) {
      res.status(401).json({ message: '憑證已失效，請重新登入' })
      return
    }
    if (payload.iat !== undefined) {
      const iatMs = payload.iat * 1000
      const pwdChangedMs = user.passwordChangedAt.getTime()
      // 60 秒時鐘偏差（FR-012）：jwt.iat 必須 >= passwordChangedAt - 60s
      if (iatMs < pwdChangedMs - 60_000) {
        res.status(401).json({ message: '憑證已失效，請重新登入' })
        return
      }
    }
    req.user = payload
    next()
  } catch (err) {
    next(err)
  }
}
