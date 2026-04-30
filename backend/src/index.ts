import 'dotenv/config'
import { resolveJwtSecret } from './utils/jwtSecret.js'

// Validate / auto-generate JWT_SECRET before anything else loads
resolveJwtSecret()

import { createApp } from './app.js'
import prisma from './utils/prisma.js'
import { logger } from './utils/logger.js'
import { startLoginLogCleanupScheduler } from './schedulers/loginLogCleanup.js'

const app = createApp()
const PORT = process.env.API_PORT ?? process.env.PORT ?? 4000

app.listen(PORT, () => {
  console.log(`VitaShelf API running on port ${PORT}`)
  // 註冊 LoginLog 清除排程（FR-028a / R-003）
  startLoginLogCleanupScheduler(prisma, logger)
})

export default app
