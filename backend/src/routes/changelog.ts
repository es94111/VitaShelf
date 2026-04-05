import { Router } from 'express'
import path from 'path'
import fs from 'fs'

const router = Router()

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
