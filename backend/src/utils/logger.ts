// 結構化 logger（winston）— 對應憲法 Technical Constraints「後端錯誤
// 必須以結構化格式記錄」與 FR-028e（loginlog_write_failed 結構化事件）。

import winston from 'winston'

const LEVEL = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

export const logger = winston.createLogger({
  level: LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
})
