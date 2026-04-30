// T028 合約測試：POST /auth/register 回應結構與 OpenAPI 3.2 schema 完全一致。
//
// 與 integration test 的差異：
//   - integration 驗證「行為」（status、Set-Cookie、副作用如 DB 寫入）
//   - contract  驗證「結構」（回應 body 嚴格符合 OpenAPI schema — 欄位、型別、必填）
//
// 兩者互補：contract 是憲法 Principle II（OpenAPI Contract-First）的閘門。

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app, prisma, resetAuthTables, closePrisma, TEST_ORIGIN } from '../integration/helper.js'
import { getResponseValidator, formatErrors } from './helper.js'

describe('Contract: POST /auth/register', () => {
  before(async () => { await resetAuthTables() })
  after(async () => { await closePrisma() })
  beforeEach(async () => { await resetAuthTables() })

  it('201 response body matches RegisterResponse schema', async () => {
    const validate = getResponseValidator('/auth/register', 'post', '201')
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: 'contract@example.com',
        password: 'ContractPass!99',
        displayName: 'Contract',
      })
    assert.equal(res.status, 201)
    const ok = validate(res.body)
    assert.ok(ok, `201 body 不符 schema: ${formatErrors(validate)}`)
    assert.equal(res.body.user.password, undefined)
    assert.equal(res.body.user.passwordChangedAt, undefined)
  })

  it('400 validation error body matches ValidationError schema', async () => {
    const validate = getResponseValidator('/auth/register', 'post', '400')
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'not-an-email', password: 'short', displayName: '' })
    assert.equal(res.status, 400)
    const ok = validate(res.body)
    assert.ok(ok, `400 body 不符 ValidationError schema: ${formatErrors(validate)}`)
    assert.ok(Array.isArray(res.body.errors))
    assert.ok(res.body.errors.length > 0)
    for (const e of res.body.errors) {
      assert.equal(typeof e.path, 'string')
      assert.equal(typeof e.message, 'string')
    }
  })

  it('400 weak password body matches ValidationError schema', async () => {
    const validate = getResponseValidator('/auth/register', 'post', '400')
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: 'weak-contract@example.com',
        password: 'password123',
        displayName: 'Weak',
      })
    assert.equal(res.status, 400)
    assert.ok(validate(res.body), formatErrors(validate))
    const passwordErr = res.body.errors.find((e: { path: string }) => e.path === 'password')
    assert.ok(passwordErr)
    assert.match(passwordErr.message, /過於常見/)
  })

  it('403 registration closed body matches GenericError schema', async () => {
    const validate = getResponseValidator('/auth/register', 'post', '403')
    // 先建立首位使用者（註冊預設會通過）
    await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send({
      email: 'first-contract@example.com',
      password: 'FirstPass!99',
      displayName: 'First',
    })
    await prisma.adminSettings.update({
      where: { id: 'singleton' },
      data: { registrationOpen: false },
    })
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: 'second-contract@example.com',
        password: 'Str0ngP@ss!Xyz',
        displayName: 'Second',
      })
    assert.equal(res.status, 403)
    assert.ok(validate(res.body), formatErrors(validate))
    assert.equal(typeof res.body.message, 'string')
  })

  it('409 duplicate email body matches GenericError schema', async () => {
    const validate = getResponseValidator('/auth/register', 'post', '409')
    await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send({
      email: 'dup-contract@example.com',
      password: 'FirstPass!99',
      displayName: 'First',
    })
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: 'dup-contract@example.com',
        password: 'OtherPass!99',
        displayName: 'Other',
      })
    assert.equal(res.status, 409)
    assert.ok(validate(res.body), formatErrors(validate))
  })
})
