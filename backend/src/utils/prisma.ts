import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client.js'

// Lazy init — Prisma 7 driver adapter reads DATABASE_URL at construction time.
// In ESM, top-level `import` is hoisted above sibling statements that set env
// vars, so we defer construction until first use to keep test helpers working.
let instance: PrismaClient | null = null

function getInstance(): PrismaClient {
  if (instance) return instance
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set before using the Prisma client')
  }
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL })
  instance = new PrismaClient({ adapter })
  return instance
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance(), prop, receiver)
  },
}) as PrismaClient

export default prisma
