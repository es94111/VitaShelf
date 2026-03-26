/**
 * ChaCha20-Poly1305 + PBKDF2-SHA256 encryption utility
 * for encrypting sensitive database fields at application layer.
 */
import crypto from 'node:crypto'

const ALGORITHM = 'chacha20-poly1305'
const KEY_LENGTH = 32  // 256 bits
const NONCE_LENGTH = 12
const TAG_LENGTH = 16
const SALT_LENGTH = 16
const PBKDF2_ITERATIONS = 100_000

/** Get or generate the encryption key from environment variable */
function getEncryptionKey(): Buffer {
  const secret = process.env.DB_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('DB_ENCRYPTION_KEY environment variable is required for database encryption')
  }
  // Derive a 256-bit key using PBKDF2-SHA256
  const salt = Buffer.from(secret.slice(0, 32).padEnd(32, '0'), 'utf-8')
  return crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')
}

/** Encrypt plaintext. Returns base64-encoded string: salt:nonce:tag:ciphertext */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const nonce = crypto.randomBytes(NONCE_LENGTH)
  const salt = crypto.randomBytes(SALT_LENGTH)

  // Derive per-message key using salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, 1, KEY_LENGTH, 'sha256')

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, nonce, { authTagLength: TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()

  // Pack: salt + nonce + tag + ciphertext
  const packed = Buffer.concat([salt, nonce, tag, encrypted])
  return packed.toString('base64')
}

/** Decrypt base64-encoded ciphertext */
export function decrypt(encoded: string): string {
  const key = getEncryptionKey()
  const packed = Buffer.from(encoded, 'base64')

  const salt = packed.subarray(0, SALT_LENGTH)
  const nonce = packed.subarray(SALT_LENGTH, SALT_LENGTH + NONCE_LENGTH)
  const tag = packed.subarray(SALT_LENGTH + NONCE_LENGTH, SALT_LENGTH + NONCE_LENGTH + TAG_LENGTH)
  const ciphertext = packed.subarray(SALT_LENGTH + NONCE_LENGTH + TAG_LENGTH)

  // Derive per-message key using salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, 1, KEY_LENGTH, 'sha256')

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, nonce, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf-8')
}

/** Check if encryption is enabled (DB_ENCRYPTION_KEY is set) */
export function isEncryptionEnabled(): boolean {
  return !!process.env.DB_ENCRYPTION_KEY
}
