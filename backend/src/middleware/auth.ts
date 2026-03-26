import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

interface JwtPayload {
  userId: string
  email: string
  role: string
}

export interface AuthRequest extends Request {
  user?: JwtPayload
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: '未授權，請先登入' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ message: 'Token 無效或已過期' })
  }
}
