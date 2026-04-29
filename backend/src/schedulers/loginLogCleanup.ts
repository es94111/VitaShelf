// 對應 FR-028a / FR-028b 與 research.md R-003。
//
// 每日 UTC 19:00（= 台北 03:00）清除 createdAt < now - 90 天 的 LoginLog；
// 由後端常駐行程持有排程（憲法 Principle V — 單一 image、不依賴容器外 cron）。

import * as cron from 'node-cron'
import type { PrismaClient } from '@prisma/client'
import type { Logger } from 'winston'

const RETENTION_DAYS = 90
const CRON_EXPRESSION = '0 19 * * *'  // 每日 UTC 19:00
const TIMEZONE = 'UTC'

function computeCutoff(): Date {
  return new Date(Date.now() - RETENTION_DAYS * 86_400_000)
}

/** 實際執行一次清除（供排程與手動觸發共用）。 */
export async function runCleanupOnce(
  prisma: PrismaClient,
  logger: Logger,
): Promise<{ deletedCount: number; durationMs: number }> {
  const start = Date.now()
  const cutoff = computeCutoff()
  try {
    const result = await prisma.loginLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    const durationMs = Date.now() - start
    logger.info({
      event: 'loginlog_cleanup_completed',
      deletedCount: result.count,
      durationMs,
      cutoff: cutoff.toISOString(),
    })
    return { deletedCount: result.count, durationMs }
  } catch (error) {
    const durationMs = Date.now() - start
    // 不中斷主流程（FR-028b），下次排程重試
    logger.warn({
      event: 'loginlog_cleanup_failed',
      durationMs,
      cutoff: cutoff.toISOString(),
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    })
    return { deletedCount: 0, durationMs }
  }
}

/** 註冊 node-cron 排程；於應用啟動時呼叫一次。 */
export function startLoginLogCleanupScheduler(
  prisma: PrismaClient,
  logger: Logger,
): cron.ScheduledTask {
  const task = cron.schedule(
    CRON_EXPRESSION,
    () => runCleanupOnce(prisma, logger),
    { timezone: TIMEZONE },
  )
  logger.info({
    event: 'loginlog_cleanup_scheduled',
    cron: CRON_EXPRESSION,
    timezone: TIMEZONE,
    retentionDays: RETENTION_DAYS,
  })
  return task
}
