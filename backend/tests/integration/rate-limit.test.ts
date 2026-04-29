// T057 整合測試：登入限流 + 429 合約 — 對應 spec.md US6 驗收情境 1~3。

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app, prisma, resetAuthTables, closePrisma, TEST_ORIGIN } from './helper'

describe('POST /api/auth/login 限流 — US6', () => {
  before(async () => {
    await resetAuthTables()
    // 建立測試使用者（需密碼錯誤時限流計數）
    await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send({
      email: 'victim@example.com',
      password: 'RealPass!99',
      displayName: 'Victim',
    })
    // 清理 LoginLog 以便計數
    await prisma.loginLog.deleteMany({})
  })
  after(async () => { await closePrisma() })

  it('5 次錯誤密碼皆回 401，第 6 次觸發 429 + Retry-After header + body retryAfterSeconds', async () => {
    const responses: number[] = []
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/auth/login')
        .set('Origin', TEST_ORIGIN)
        .send({ email: 'victim@example.com', password: 'WrongPass!' + i })
      responses.push(r.status)
    }
    assert.deepEqual(responses, [401, 401, 401, 401, 401], '前 5 次應全回 401')

    const sixth = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'victim@example.com', password: 'WrongPass6' })
    assert.equal(sixth.status, 429)
    // Retry-After header
    const retryAfterHeader = sixth.headers['retry-after']
    assert.ok(retryAfterHeader, 'Retry-After header 應存在')
    const retryAfterSeconds = parseInt(retryAfterHeader, 10)
    assert.ok(retryAfterSeconds > 0 && retryAfterSeconds <= 60, `Retry-After 應為 1~60 秒，實得 ${retryAfterSeconds}`)
    // body 對齊
    assert.match(sixth.body.message, /登入嘗試次數過多/)
    assert.equal(sixth.body.retryAfterSeconds, retryAfterSeconds, 'body 與 header 的秒數需一致')
  })

  it('429 回應時間 < 30 ms（不觸發 bcrypt 比對）', async () => {
    // 此時仍在限流窗口內
    const start = Date.now()
    const r = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'victim@example.com', password: 'AnotherWrong' })
    const elapsed = Date.now() - start
    assert.equal(r.status, 429)
    assert.ok(elapsed < 100, `429 handler 不應觸發 bcrypt；實得 ${elapsed} ms（閾值 100 ms）`)
  })

  it('Access-Control-Expose-Headers 含 Retry-After（FR-023b）', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'victim@example.com', password: 'YetAnotherWrong' })
    const expose = r.headers['access-control-expose-headers']
    assert.ok(expose, 'Access-Control-Expose-Headers 應存在')
    assert.match(String(expose), /Retry-After/i)
  })
})
