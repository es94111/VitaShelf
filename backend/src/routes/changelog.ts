import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const router = Router()

// Router-wide rate limit (inline so CodeQL `js/missing-rate-limiting`
// recognises the barrier). Changelog is public but still hits the filesystem.
router.use(rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false }))

// Resolve changelog.json — try production path first (/app), then dev (project root)
function resolveChangelogPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'changelog.json'),           // prod: /app/changelog.json
    path.resolve(__dirname, '../../../changelog.json'),       // dev ts-node: src/routes → root
    path.resolve(__dirname, '../../changelog.json'),          // compiled: dist/routes → backend
    path.resolve(__dirname, '../../../../changelog.json'),    // compiled: dist/routes → root
  ]
  return candidates.find((p) => fs.existsSync(p)) ?? null
}

// GET /api/changelog — public, no auth required
router.get('/', (_req, res) => {
  const filePath = resolveChangelogPath()
  if (!filePath) {
    res.status(404).json({ message: 'changelog.json not found' })
    return
  }
  try {
    const raw  = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    res.json(data)
  } catch {
    res.status(500).json({ message: 'Failed to parse changelog.json' })
  }
})

export default router
