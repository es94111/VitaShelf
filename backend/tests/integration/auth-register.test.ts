// T029 整合測試：POST /api/auth/register — 對應 spec.md US1 的 5 個驗收情境。

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app, prisma, resetAuthTables, closePrisma, TEST_ORIGIN } from './helper'

describe('POST /api/auth/register — US1', () => {
  before(async () => { await resetAuthTables() })
  after(async () => { await closePrisma() })
  beforeEach(async () => { await resetAuthTables() })

  it('情境 1：合法輸入 → 201 + 首位使用者自動成為 ADMIN', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: 'alice@example.com',
        password: 'Str0ngPass!99',
        displayName: 'Alice',
      })
    assert.equal(res.status, 201)
    assert.equal(res.body.user.email, 'alice@example.com')
    assert.equal(res.body.user.displayName, 'Alice')
    assert.equal(res.body.user.role, 'ADMIN') // 首位使用者
    assert.equal(res.body.user.authProvider, 'LOCAL')
    assert.equal(res.body.user.theme, 'light')
    assert.equal(res.body.user.isActive, true)
    assert.equal(res.body.user.password, undefined, '回應 body 不得含 password')
    assert.equal(res.body.user.passwordChangedAt, undefined, '回應 body 不得含 passwordChangedAt')
  })

  it('情境 2：註冊關閉時 → 403 目前不開放註冊（非首位使用者）', async () => {
    // 先建立首位使用者佔位
    await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send({
      email: 'first@example.com',
      password: 'FirstPass!99',
      displayName: 'First',
    })
    // 關閉註冊
    await prisma.adminSettings.update({
      where: { id: 'singleton' },
      data: { registrationOpen: false },
    })
    // 第二位使用者嘗試註冊
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: 'bob@example.com',
        password: 'BobPass!99',
        displayName: 'Bob',
      })
    assert.equal(res.status, 403)
    assert.match(res.body.message, /不開放註冊/)
    // DB 未新增使用者
    const bob = await prisma.user.findUnique({ where: { email: 'bob@example.com' } })
    assert.equal(bob, null)
  })

  it('情境 3：重複 email → 409 帳號已存在', async () => {
    await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send({
      email: 'dup@example.com',
      password: 'FirstPass!99',
      displayName: 'Dup',
    })
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: 'dup@example.com',
        password: 'OtherPass!99',
        displayName: 'Other',
      })
    assert.equal(res.status, 409)
    assert.match(res.body.message, /已存在/)
  })

  it('情境 4a：email 格式錯誤 → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: 'not-an-email',
        password: 'Str0ngPass!99',
        displayName: 'Bad',
      })
    assert.equal(res.status, 400)
    assert.ok(Array.isArray(res.body.errors), 'errors 應為陣列')
    assert.ok(res.body.errors.some((e: { path: string }) => e.path === 'email'))
  })

  it('情境 4b：密碼長度不足 → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: 'short@example.com',
        password: 'short',
        displayName: 'Short',
      })
    assert.equal(res.status, 400)
    assert.ok(res.body.errors.some((e: { path: string; message: string }) =>
      e.path === 'password' && /8 字元/.test(e.message)))
  })

  it('情境 5：弱密碼命中 top-10k 清單 → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: 'weak@example.com',
        password: 'password123',
        displayName: 'Weak',
      })
    assert.equal(res.status, 400)
    const msg = res.body.errors.find((e: { path: string }) => e.path === 'password')?.message
    assert.match(msg ?? '', /過於常見/)
    // DB 未新增使用者
    const weak = await prisma.user.findUnique({ where: { email: 'weak@example.com' } })
    assert.equal(weak, null)
  })

  it('密碼以 bcrypt 雜湊儲存，不明文落庫（SC-005）', async () => {
    await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send({
      email: 'hash@example.com',
      password: 'HashedRight!99',
      displayName: 'Hash',
    })
    const user = await prisma.user.findUnique({
      where: { email: 'hash@example.com' },
      select: { password: true },
    })
    assert.ok(user)
    assert.ok(/^\$2[aby]\$/.test(user.password), 'password 須為 bcrypt 格式')
    assert.equal(user.password.length, 60)
    assert.notEqual(user.password, 'HashedRight!99', '明文不得落庫')
  })

  it('email 經 trim + lowercase 正規化（FR-003a）', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({
        email: '  Alice@Example.COM  ',
        password: 'GoodPass!99',
        displayName: 'Normalized',
      })
    assert.equal(res.status, 201)
    assert.equal(res.body.user.email, 'alice@example.com')
  })
})
