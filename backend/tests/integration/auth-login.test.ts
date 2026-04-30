// T034 整合測試：POST /api/auth/login — 對應 spec.md US2 的驗收情境。

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app, prisma, resetAuthTables, closePrisma, TEST_ORIGIN } from './helper.js'

async function registerUser(email: string, password: string, displayName: string) {
  return request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send({
    email,
    password,
    displayName,
  })
}

describe('POST /api/auth/login — US2', () => {
  before(async () => { await resetAuthTables() })
  after(async () => { await closePrisma() })
  beforeEach(async () => {
    await resetAuthTables()
    await registerUser('alice@example.com', 'Str0ngPass!99', 'Alice')
  })

  it('情境 1：正確 email + 正確密碼 → 200 + Set-Cookie + body 僅含 user（不含 token）', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'alice@example.com', password: 'Str0ngPass!99' })
    assert.equal(res.status, 200)
    // Set-Cookie 屬性完整
    const setCookie = res.headers['set-cookie']
    assert.ok(setCookie, 'Set-Cookie header 應存在')
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie)
    assert.match(cookieStr, /^token=/)
    assert.match(cookieStr, /HttpOnly/)
    assert.match(cookieStr, /Secure/)
    assert.match(cookieStr, /SameSite=Strict/)
    assert.match(cookieStr, /Max-Age=604800/)
    // body 不含 token
    assert.equal(res.body.token, undefined, 'body 不得含 token 明文')
    assert.equal(res.body.user.email, 'alice@example.com')
    assert.equal(res.body.user.password, undefined)
  })

  it('情境 2：錯誤密碼 → 401 帳號或密碼錯誤', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'alice@example.com', password: 'WrongPass!99' })
    assert.equal(res.status, 401)
    assert.match(res.body.message, /帳號或密碼錯誤/)
  })

  it('情境 3：帳號不存在 → 401 同樣訊息（不可區分）', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'ghost@example.com', password: 'WhateverPass!99' })
    assert.equal(res.status, 401)
    assert.match(res.body.message, /帳號或密碼錯誤/)
  })

  it('情境 2 + 3 回應訊息完全一致（無 enumeration）', async () => {
    const wrong = await request(app).post('/api/auth/login').set('Origin', TEST_ORIGIN)
      .send({ email: 'alice@example.com', password: 'WrongPass!99' })
    const ghost = await request(app).post('/api/auth/login').set('Origin', TEST_ORIGIN)
      .send({ email: 'ghost@example.com', password: 'AnyPass!99' })
    assert.equal(wrong.status, ghost.status)
    assert.deepEqual(wrong.body, ghost.body)
  })

  it('情境 4：帳號被停用 → 403', async () => {
    await prisma.user.update({
      where: { email: 'alice@example.com' },
      data: { isActive: false },
    })
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'alice@example.com', password: 'Str0ngPass!99' })
    assert.equal(res.status, 403)
    assert.match(res.body.message, /停用/)
  })

  it('登入成功後以 cookie 存取 /api/users/me → 200', async () => {
    const login = await request(app).post('/api/auth/login').set('Origin', TEST_ORIGIN)
      .send({ email: 'alice@example.com', password: 'Str0ngPass!99' })
    const cookie = login.headers['set-cookie']
    const me = await request(app).get('/api/users/me').set('Cookie', cookie)
    assert.equal(me.status, 200)
    assert.equal(me.body.email, 'alice@example.com')
  })

  it('未帶 cookie 存取 /me → 401', async () => {
    const me = await request(app).get('/api/users/me')
    assert.equal(me.status, 401)
  })

  it('email 格式錯誤 → 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Origin', TEST_ORIGIN)
      .send({ email: 'not-an-email', password: 'whatever' })
    assert.equal(res.status, 400)
  })

  it('每次登入嘗試皆寫入 LoginLog（FR-024/025）', async () => {
    // 清 LoginLog 以便精確計數
    await prisma.loginLog.deleteMany({})
    // 1 次錯誤 + 1 次成功
    await request(app).post('/api/auth/login').set('Origin', TEST_ORIGIN)
      .send({ email: 'alice@example.com', password: 'wrong' })
    await request(app).post('/api/auth/login').set('Origin', TEST_ORIGIN)
      .send({ email: 'alice@example.com', password: 'Str0ngPass!99' })
    const logs = await prisma.loginLog.findMany({ orderBy: { createdAt: 'asc' } })
    assert.equal(logs.length, 2)
    assert.equal(logs[0].success, false)
    assert.equal(logs[0].reason, 'wrong_password')
    assert.equal(logs[0].method, 'local')
    assert.ok(logs[0].ip.length > 0, 'ip 不得為空')
    assert.notEqual(logs[0].country, null, 'country 非 null（查不到則為空字串）')
    assert.equal(logs[1].success, true)
    assert.equal(logs[1].reason, null)
  })
})
