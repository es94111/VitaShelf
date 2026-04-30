// 對應 FR-024 ~ FR-028 與 FR-028d / FR-028e（fail-open + winston error log）。
//
// 任何登入相關端點 MUST 透過 writeLoginLog() 寫稽核紀錄；
// 此函式 **不重拋** 任何資料庫錯誤，而是以 logger.error 紀錄
// 供運維事後察覺稽核遺失事件（事件名 "loginlog_write_failed"）。

import prisma from './prisma.js'
import { logger } from './logger.js'

export type LoginLogReason =
  | 'wrong_password'
  | 'email_not_found'
  | 'rate_limited'
  | 'registration_closed'
  | 'validation_error'
  | 'account_disabled'
  | 'other'

export interface WriteLoginLogParams {
  userId?: string | null
  email: string
  ip: string
  country: string
  method?: string           // 預設 'local'
  success: boolean
  reason?: LoginLogReason | null
}

export async function writeLoginLog(params: WriteLoginLogParams): Promise<void> {
  try {
    await prisma.loginLog.create({
      data: {
        userId: params.userId ?? null,
        email: params.email,
        ip: params.ip,
        country: params.country,
        method: params.method ?? 'local',
        success: params.success,
        reason: params.reason ?? null,
      },
    })
  } catch (error) {
    // Fail-open（FR-028d）：不中斷登入流程；以結構化 log 保留事件（FR-028e）
    logger.error({
      event: 'loginlog_write_failed',
      email: params.email,
      ip: params.ip,
      country: params.country,
      method: params.method ?? 'local',
      success: params.success,
      reason: params.reason ?? null,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    })
  }
}
