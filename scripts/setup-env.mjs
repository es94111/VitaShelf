#!/usr/bin/env node
/**
 * VitaShelf — Environment Setup Script
 *
 * Usage:
 *   node scripts/setup-env.mjs          # interactive: fills .env from .env.example
 *   node scripts/setup-env.mjs --force  # overwrite existing .env
 *
 * What it does:
 *   1. Copies .env.example → .env  (skips if .env already exists, unless --force)
 *   2. Generates a cryptographically random JWT_SECRET  (64 bytes → 128-char hex)
 *   3. Writes the secret into .env
 */

import crypto from 'crypto'
import fs     from 'fs'
import path   from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')
const ENV_EXAMPLE = path.join(ROOT, '.env.example')
const ENV_FILE    = path.join(ROOT, '.env')
const FORCE       = process.argv.includes('--force')

// ── 1. Copy .env.example → .env ──────────────────────────────────────────────
if (!fs.existsSync(ENV_EXAMPLE)) {
  console.error('❌  .env.example not found. Aborting.')
  process.exit(1)
}

if (fs.existsSync(ENV_FILE) && !FORCE) {
  console.log('ℹ️   .env already exists. Skipping copy  (use --force to overwrite).')
} else {
  fs.copyFileSync(ENV_EXAMPLE, ENV_FILE)
  console.log('✅  .env created from .env.example')
}

// ── 2. Generate JWT_SECRET ────────────────────────────────────────────────────
const secret  = crypto.randomBytes(64).toString('hex')  // 128-char hex
let   content = fs.readFileSync(ENV_FILE, 'utf8')

if (/^JWT_SECRET=.*/m.test(content)) {
  content = content.replace(/^JWT_SECRET=.*/m, `JWT_SECRET=${secret}`)
} else {
  content += `\nJWT_SECRET=${secret}\n`
}

fs.writeFileSync(ENV_FILE, content, 'utf8')

// ── 3. Report ─────────────────────────────────────────────────────────────────
console.log('')
console.log('🔑  JWT_SECRET generated successfully:')
console.log(`    ${secret}`)
console.log('')
console.log('📄  Written to: .env')
console.log('')
console.log('⚠️   Never commit .env to version control!')
console.log('    (.gitignore already excludes it)')
console.log('')
