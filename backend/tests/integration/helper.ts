// 整合測試輔助：提供一個共用 Express app 實例（supertest 用）、
// 以及資料庫 reset 函式（每個 describe 開始前清空 User / LoginLog / AdminSettings）。
//
// 測試使用與 dev 相同的 SQLite 檔案（backend/data/vitashelf.db），因 Prisma migration
// 已套用；測試前 truncate 即可避免造成 schema 漂移。若要更嚴格隔離，可改設
// DATABASE_URL=file:./data/test.db 並於本檔初始化時呼叫 prisma migrate deploy。

// 環境變數需在 import app / prisma 前設定；測試使用專屬 test.db 避免污染 dev 資料
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret-at-least-32-chars-long-aaaa'
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000'
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/test.db'
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test'
// 關閉 request logger 輸出以保持測試報告清潔
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error'

import { createApp } from '../../src/app.js'
import prisma from '../../src/utils/prisma.js'
import { loginRateLimitStore } from '../../src/middleware/rateLimit.js'

export const app = createApp()

export const TEST_ORIGIN = 'http://localhost:3000'

/** 清空所有驗證相關資料表 + 重置 login rate limit 計數；保留 schema。 */
export async function resetAuthTables(): Promise<void> {
  await prisma.loginLog.deleteMany({})
  await prisma.user.deleteMany({})
  // AdminSettings 為 singleton，只 reset 其內容而非刪除
  await prisma.adminSettings.upsert({
    where: { id: 'singleton' },
    update: { registrationOpen: true, registrationNotice: '' },
    create: { id: 'singleton', registrationOpen: true, registrationNotice: '' },
  })
  // 重置 rate limit MemoryStore（避免跨測試影響）
  loginRateLimitStore.resetAll()
}

/** 關閉 Prisma 連線（測試完畢呼叫）。 */
export async function closePrisma(): Promise<void> {
  await prisma.$disconnect()
}

export { prisma }
