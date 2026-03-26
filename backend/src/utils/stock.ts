import prisma from './prisma'
import { addDays, differenceInDays, isPast } from 'date-fns'


export type AlertLevel = 'ok' | 'warn' | 'danger' | 'expired'

/**
 * Compute current stock by replaying all StockLog entries for a product.
 * IN adds, OUT_USE/OUT_DISCARD subtracts, ADJUST sets the absolute value.
 */
export async function computeStock(productId: string): Promise<{
  currentStock: number
  openedCount: number
  discardedCount: number
}> {
  const logs = await prisma.stockLog.findMany({ where: { productId } })

  let current   = 0
  let opened    = 0
  let discarded = 0

  for (const log of logs) {
    switch (log.type) {
      case 'IN':
        current += log.quantity
        break
      case 'OUT_USE':
        current -= log.quantity
        opened  += log.quantity
        break
      case 'OUT_DISCARD':
        current   -= log.quantity
        discarded += log.quantity
        break
      case 'ADJUST':
        current = log.quantity
        break
    }
  }

  return { currentStock: Math.max(0, current), openedCount: opened, discardedCount: discarded }
}

/**
 * Determine alert level based on the nearest expiry date for a product.
 * Returns 'ok' when no purchases exist.
 */
export function getAlertLevel(expiryDate: Date | null | undefined): AlertLevel {
  if (!expiryDate) return 'ok'
  if (isPast(expiryDate)) return 'expired'
  const days = differenceInDays(expiryDate, new Date())
  if (days <= 7)  return 'danger'
  if (days <= 30) return 'warn'
  return 'ok'
}

/**
 * Get the nearest upcoming (or past) expiry date for a product.
 */
export async function getNearestExpiry(productId: string): Promise<Date | null> {
  const purchase = await prisma.purchaseRecord.findFirst({
    where: { productId },
    orderBy: { expiryDate: 'asc' },
    select: { expiryDate: true },
  })
  return purchase?.expiryDate ?? null
}

/**
 * Compute alert level directly from stockLogs array (no extra DB call).
 * Used in list endpoints where logs are already fetched.
 */
export function computeStockFromLogs(
  logs: Array<{ type: string; quantity: number }>,
): number {
  let current = 0
  for (const log of logs) {
    if (log.type === 'IN')           current += log.quantity
    if (log.type === 'OUT_USE')      current -= log.quantity
    if (log.type === 'OUT_DISCARD')  current -= log.quantity
    if (log.type === 'ADJUST')       current  = log.quantity
  }
  return Math.max(0, current)
}
