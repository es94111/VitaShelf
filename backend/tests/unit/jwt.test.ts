// 對應 T017：驗證 backend/src/utils/jwt.ts 的 FR-008 / FR-009 / FR-012 行為。

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

// JWT_SECRET 必須在 import 前設定
process.env.JWT_SECRET = 'unit-test-secret-at-least-32-chars-long-aaaaaaaa'

// 動態 import 以確保上面的環境變數生效
let jwtUtil: typeof import('../../src/utils/jwt.js')

before(async () => {
  jwtUtil = await import('../../src/utils/jwt.js')
})

describe('jwt.ts — signToken / verifyToken', () => {
  it('sign + verify round-trip 保留 payload 欄位', () => {
    const token = jwtUtil.signToken({
      userId: 'user-123',
      email: 'alice@example.com',
      role: 'USER',
    })
    const decoded = jwtUtil.verifyToken(token)
    assert.equal(decoded.userId, 'user-123')
    assert.equal(decoded.email, 'alice@example.com')
    assert.equal(decoded.role, 'USER')
    assert.equal(typeof decoded.iat, 'number')
    assert.equal(typeof decoded.exp, 'number')
  })

  it('token 以 HS256 簽章', () => {
    const token = jwtUtil.signToken({ userId: 'u', email: 'e@x.com', role: 'USER' })
    const [headerB64] = token.split('.')
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'))
    assert.equal(header.alg, 'HS256')
    assert.equal(header.typ, 'JWT')
  })

  it('exp 約等於 iat + 7d', () => {
    const token = jwtUtil.signToken({ userId: 'u', email: 'e@x.com', role: 'USER' })
    const decoded = jwtUtil.verifyToken(token)
    const diff = (decoded.exp ?? 0) - (decoded.iat ?? 0)
    // 7 天 = 604800 秒
    assert.equal(diff, 604800, `expected 604800s, got ${diff}s`)
  })

  it('拒絕 alg=none 攻擊（algorithm confusion）', () => {
    // 以 alg=none 偽造 token
    const fakeHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const fakePayload = Buffer.from(JSON.stringify({ userId: 'hacker', email: 'h@x.com', role: 'ADMIN' })).toString('base64url')
    const fakeToken = `${fakeHeader}.${fakePayload}.`
    assert.throws(() => jwtUtil.verifyToken(fakeToken), /jwt|invalid|algorithm/i)
  })

  it('過期 token 拋 TokenExpiredError', () => {
    // 以相同 secret 手動產生過期 token
    const expiredToken = jwt.sign(
      { userId: 'u', email: 'e@x.com', role: 'USER' },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '-1h' },
    )
    assert.throws(() => jwtUtil.verifyToken(expiredToken), /expired/i)
  })

  it('clockTolerance 60 秒：iat 於未來 30 秒內仍被接受', () => {
    // iat 稍微偏未來（例如部署節點時鐘快），驗證應容忍 60 秒
    const nowSec = Math.floor(Date.now() / 1000)
    const tokenSlightFuture = jwt.sign(
      { userId: 'u', email: 'e@x.com', role: 'USER', iat: nowSec + 30 },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '7d' },
    )
    // 應不拋例外
    const decoded = jwtUtil.verifyToken(tokenSlightFuture)
    assert.equal(decoded.userId, 'u')
  })
})

describe('jwt.ts — Cookie headers', () => {
  it('authCookieSetHeader 含所有安全屬性 + 7 天 Max-Age', () => {
    const header = jwtUtil.authCookieSetHeader('some.jwt.token')
    assert.ok(header.startsWith('token=some.jwt.token'), 'cookie 名稱應為 token')
    assert.ok(header.includes('HttpOnly'), '須含 HttpOnly')
    assert.ok(header.includes('Secure'), '須含 Secure')
    assert.ok(header.includes('SameSite=Strict'), '須含 SameSite=Strict')
    assert.ok(header.includes('Path=/'), '須含 Path=/')
    assert.ok(header.includes('Max-Age=604800'), '須含 Max-Age=604800')
  })

  it('clearAuthCookieHeader 為空值 + Max-Age=0', () => {
    const header = jwtUtil.clearAuthCookieHeader()
    assert.ok(header.startsWith('token=;') || header.startsWith('token=; '))
    assert.ok(header.includes('Max-Age=0'), '須含 Max-Age=0 以清除 cookie')
    assert.ok(header.includes('HttpOnly'))
    assert.ok(header.includes('Secure'))
    assert.ok(header.includes('SameSite=Strict'))
  })

  it('COOKIE_NAME 常數為 "token"', () => {
    assert.equal(jwtUtil.COOKIE_NAME, 'token')
  })
})
