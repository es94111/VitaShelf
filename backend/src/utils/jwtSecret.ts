import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const PLACEHOLDER = 'change-me-to-a-long-random-secret'
const MIN_LENGTH  = 32

/**
 * Validates JWT_SECRET at startup.
 *
 * - Production : missing / placeholder → hard exit (never start with an insecure secret)
 * - Development: missing / placeholder → auto-generate an in-memory ephemeral secret,
 *                persist it to .env so it survives hot-reloads within the same session,
 *                and warn the developer.
 *
 * Returns the validated (or generated) secret string.
 */
export function resolveJwtSecret(): string {
  const env    = process.env.NODE_ENV ?? 'development'
  const secret = process.env.JWT_SECRET

  const isUnset = !secret || secret.trim() === '' || secret === PLACEHOLDER

  // ── Production: hard-fail ────────────────────────────────────────────────────
  if (env === 'production') {
    if (isUnset) {
      console.error(
        '[FATAL] JWT_SECRET is not set or is still the default placeholder.\n' +
        '        Set a strong random value (≥ 32 chars) in your environment before starting.',
      )
      process.exit(1)
    }
    if (secret!.length < MIN_LENGTH) {
      console.error(
        `[FATAL] JWT_SECRET is too short (${secret!.length} chars). Minimum is ${MIN_LENGTH}.`,
      )
      process.exit(1)
    }
    return secret!
  }

  // ── Development: auto-generate ───────────────────────────────────────────────
  if (isUnset) {
    const generated = crypto.randomBytes(48).toString('hex') // 96-char hex string
    process.env.JWT_SECRET = generated

    // Persist to .env so hot-reloads (tsx watch) keep the same secret
    persistToEnvFile(generated)

    console.warn(
      '\n⚠️  [JWT_SECRET] Not set — a random secret has been generated for this session:\n' +
      `   ${generated}\n` +
      '   This secret has been written to your .env file.\n' +
      '   ⚡ Existing JWT tokens will be invalidated on each restart until you fix this.\n',
    )
    return generated
  }

  return secret!
}

/** Writes or updates JWT_SECRET in the local .env file. */
function persistToEnvFile(secret: string): void {
  // Look for .env in the project root (two levels up from src/utils/)
  const envPath = path.resolve(__dirname, '..', '..', '..', '.env')

  try {
    let content = ''

    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8')

      if (/^JWT_SECRET=.*/m.test(content)) {
        // Replace existing JWT_SECRET line
        content = content.replace(/^JWT_SECRET=.*/m, `JWT_SECRET=${secret}`)
      } else {
        // Append
        content += `\nJWT_SECRET=${secret}\n`
      }
    } else {
      content = `JWT_SECRET=${secret}\n`
    }

    fs.writeFileSync(envPath, content, 'utf8')
  } catch {
    // Non-fatal — .env write may fail in certain environments (e.g. read-only FS)
    console.warn('[JWT_SECRET] Could not persist to .env — secret is ephemeral this session only.')
  }
}
