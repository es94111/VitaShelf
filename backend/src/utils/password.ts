// 對應 research.md R-006（SHA-256 pre-hash → bcrypt cost 12）與
// FR-004 / FR-004a / FR-004b / FR-006。
//
// Dummy hash 策略（對應 M-003 與 SC-006 時序一致性）：
// 模組載入時預先計算一個 dummy hash；當 verifyPassword 被呼叫但
// user 不存在時，呼叫者仍應以 dummy hash 比對一次，讓「帳號不存在」
// 與「密碼錯誤」的回應時間分佈盡量一致。

import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { isWeakPassword } from './weakPasswords'

const BCRYPT_COST = 12

function preHash(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('base64')
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(preHash(plain), BCRYPT_COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(preHash(plain), hash)
}

/** Pre-computed hash of a random password; used for constant-time
 *  comparisons when the user does not exist (SC-006). */
export const DUMMY_HASH = bcrypt.hashSync(
  preHash(randomBytes(24).toString('base64')),
  BCRYPT_COST,
)

/** Constant-time check: always runs bcrypt.compare even if user is absent. */
export async function verifyPasswordConstantTime(
  plain: string,
  hash: string | null,
): Promise<boolean> {
  if (hash === null) {
    await bcrypt.compare(preHash(plain), DUMMY_HASH)
    return false
  }
  return verifyPassword(plain, hash)
}

export { isWeakPassword }
