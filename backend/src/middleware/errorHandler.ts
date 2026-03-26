import type { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.statusCode ?? 500
  const message = status === 500 ? '伺服器內部錯誤' : err.message
  console.error(`[Error] ${status} — ${err.message}`)
  res.status(status).json({ message, code: err.code })
}
