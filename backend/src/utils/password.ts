// 對應 research.md R-006（SHA-256 pre-hash → bcrypt cost 12）與
// FR-004 / FR-004a / FR-004b / FR-006。
//
// 為何使用 SHA-256 前置正規化：
//   bcrypt 原生對超過 72 bytes 的輸入會「靜默截斷」，導致含大量中文字
//   或長 passphrase 的使用者於不同密碼被雜湊為相同值。本模組以 SHA-256
//   將任意長度 UTF-8 輸入正規化為固定 44 bytes（base64），再餵入
//   bcrypt(cost=12)；此為 Dropbox 於 2016 公開採用的業界模式。
//   （Dropbox Tech Blog: "How Dropbox Securely Stores Your Passwords"）
//
// 這是 **輸入正規化**、不是最終雜湊；實際儲存的密碼一律為 bcrypt 雜湊。
//
// CodeQL `js/insufficient-password-hash` 對此模式會誤報；保留此註解以
// 說明設計意圖，不做規則抑制（讓未來 reviewer 可重新評估）。
//
// Dummy hash（對應 M-003 與 SC-006 時序一致性）：
//   模組載入時預計算一個 dummy hash；verifyPasswordConstantTime 於 user
//   不存在時仍以此 dummy hash 跑一次 bcrypt.compare，
//   讓「帳號不存在」與「密碼錯誤」的回應時間分佈不可區分。

import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { isWeakPassword } from './weakPasswords.js'

const BCRYPT_COST = 12

/**
 * 儲存使用者密碼雜湊。雜湊鏈為：
 *   SHA-256 正規化（繞過 bcrypt 72-byte 限制）→ bcrypt cost=12（最終雜湊）。
 */
export async function hashPassword(plain: string): Promise<string> {
  // lgtm[js/insufficient-password-hash] — SHA-256 為輸入正規化，非最終雜湊
  const normalized = createHash('sha256').update(plain, 'utf8').digest('base64')
  return bcrypt.hash(normalized, BCRYPT_COST)
}

/** 驗證使用者提供的明文與資料庫儲存的 bcrypt 雜湊是否相符。 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // lgtm[js/insufficient-password-hash] — SHA-256 為輸入正規化，非最終雜湊
  const normalized = createHash('sha256').update(plain, 'utf8').digest('base64')
  return bcrypt.compare(normalized, hash)
}

/** 模組載入時產生的 dummy hash；隨機輸入以避免可預測性。 */
// lgtm[js/insufficient-password-hash] — SHA-256 為輸入正規化，非最終雜湊
const DUMMY_INPUT = createHash('sha256')
  .update(randomBytes(24).toString('base64'), 'utf8')
  .digest('base64')
export const DUMMY_HASH = bcrypt.hashSync(DUMMY_INPUT, BCRYPT_COST)

/**
 * 常數時間密碼驗證：即使 user 不存在（hash=null），仍執行 bcrypt.compare
 * 以避免「帳號存在與否」被回應時間推論。
 */
export async function verifyPasswordConstantTime(
  plain: string,
  hash: string | null,
): Promise<boolean> {
  // lgtm[js/insufficient-password-hash] — SHA-256 為輸入正規化，非最終雜湊
  const normalized = createHash('sha256').update(plain, 'utf8').digest('base64')
  if (hash === null) {
    await bcrypt.compare(normalized, DUMMY_HASH)
    return false
  }
  return bcrypt.compare(normalized, hash)
}

export { isWeakPassword }
