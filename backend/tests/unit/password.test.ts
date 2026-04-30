// 對應 T015：驗證 backend/src/utils/password.ts 的 FR-006 / FR-004b 行為。

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  hashPassword,
  verifyPassword,
  verifyPasswordConstantTime,
  isWeakPassword,
  DUMMY_HASH,
} from '../../src/utils/password.js'

describe('password.ts — hashPassword / verifyPassword', () => {
  it('hashPassword 產出 bcrypt 格式（$2[aby]$ 開頭、長度 60）', async () => {
    const hash = await hashPassword('GoodPass!99')
    assert.ok(/^\$2[aby]\$/.test(hash), `hash "${hash}" 不符 bcrypt 前綴`)
    assert.equal(hash.length, 60, 'bcrypt hash 長度應為 60')
  })

  it('verifyPassword 正確密碼回 true', async () => {
    const hash = await hashPassword('Str0ngPass!')
    assert.equal(await verifyPassword('Str0ngPass!', hash), true)
  })

  it('verifyPassword 錯誤密碼回 false', async () => {
    const hash = await hashPassword('Str0ngPass!')
    assert.equal(await verifyPassword('WrongPass!', hash), false)
  })

  it('超過 72 byte 的 UTF-8 密碼仍可正確 hash + verify（pre-hash 運作）', async () => {
    // bcrypt 原生上限 72 bytes；SHA-256 pre-hash 後固定 44 bytes。
    // 用全中文 + 長字串確保 UTF-8 編碼後 > 72 bytes（每中文字 3 bytes × 30 = 90 bytes）
    const longPassword = '一段非常長的密碼段落放在這裡作為測試字串一二三四五六七八九十'
    assert.ok(Buffer.byteLength(longPassword, 'utf8') > 72, '測試密碼需 > 72 bytes')
    const hash = await hashPassword(longPassword)
    assert.equal(await verifyPassword(longPassword, hash), true)
    // 相近但不同的長密碼應被區分（若 bcrypt 截斷則會誤判為同）
    const similarDifferent = longPassword + '_extra'
    assert.equal(await verifyPassword(similarDifferent, hash), false)
  })

  it('DUMMY_HASH 本身為有效的 bcrypt 格式', () => {
    assert.ok(/^\$2[aby]\$/.test(DUMMY_HASH))
    assert.equal(DUMMY_HASH.length, 60)
  })

  it('verifyPasswordConstantTime(plain, null) 回 false 且仍執行 bcrypt.compare（時序不短路）', async () => {
    const start = Date.now()
    const result = await verifyPasswordConstantTime('anything', null)
    const elapsedMs = Date.now() - start
    assert.equal(result, false)
    // bcrypt(cost=12) 比對預期耗時 > 50 ms；若直接短路應遠小於此
    assert.ok(elapsedMs > 20, `期望耗時 > 20 ms 以確保 bcrypt 實際執行，實際 ${elapsedMs} ms`)
  })

  it('verifyPasswordConstantTime 正確密碼仍回 true', async () => {
    const hash = await hashPassword('CorrectPass!1')
    assert.equal(await verifyPasswordConstantTime('CorrectPass!1', hash), true)
  })
})

describe('password.ts — isWeakPassword', () => {
  it('命中 top-10k 清單的密碼回 true', () => {
    assert.equal(isWeakPassword('password123'), true)
    assert.equal(isWeakPassword('12345678'), true)
    assert.equal(isWeakPassword('qwerty'), true)
    assert.equal(isWeakPassword('letmein'), true)
  })

  it('大小寫不敏感', () => {
    assert.equal(isWeakPassword('PASSWORD'), true)
    assert.equal(isWeakPassword('Password'), true)
    assert.equal(isWeakPassword('QWERTY'), true)
  })

  it('強密碼回 false', () => {
    assert.equal(isWeakPassword('Tr0ub4dor&3-correct-horse'), false)
    assert.equal(isWeakPassword('Str0ngP@ss!Xyz_unique'), false)
    assert.equal(isWeakPassword('K9#mN2$pQ7@vR4'), false)
  })
})
