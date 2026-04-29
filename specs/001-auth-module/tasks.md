---
description: 認證模組（Auth Module）實作任務清單
---

# Tasks: 認證模組（Auth Module）

**Input**: 設計文件位於 `/specs/001-auth-module/`
**Prerequisites**: [`plan.md`](./plan.md) / [`spec.md`](./spec.md) / [`research.md`](./research.md) / [`data-model.md`](./data-model.md) / [`contracts/auth.openapi.yaml`](./contracts/auth.openapi.yaml) / [`quickstart.md`](./quickstart.md)

> **Tests**：本模組 spec 的 SC-003、SC-004、SC-005、SC-006、SC-008、SC-009、SC-010 皆為可驗證的成功準則；FR-029 明訂契約測試必要性。**包含** contract test 與 integration test 任務。
>
> **Organization**：任務以 User Story 分組；完成 Phase 1 + 2 + 任一 Story 即為可獨立交付切片。
>
> **憲法對齊**：本檔 zh-TW（Principle I）；OpenAPI 先於實作（Principle II）；TypeScript strict（III）；rate limit / validator / CSRF inline（IV）；Docker Compose 為執行平台（V）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**：不同檔案、無前置依賴，可與同 Phase 內其他 [P] 任務並行
- **[Story]**：US1 ~ US6 對應 [spec.md](./spec.md) §1 的六則使用者故事
- 所有描述含絕對或 repo 相對路徑；本專案為 web application monorepo（`backend/`、`frontend/`）

---

## Phase 1：Setup（共用基礎建設）

**Purpose**：確認專案工具鏈、相依套件、schema 產生器到位。

- [x] T001 檢查既有 `package.json` — 後端相依套件已包含 `bcryptjs`、`jsonwebtoken`、`express-validator`、`express-rate-limit`、`node-cron`、`winston`；若缺任一則以 `cd backend && npm install <pkg>` 補齊（依 [plan.md](./plan.md) 鎖定版本）
- [x] T002 [P] 新增後端相依套件 `cookie-parser`（cookie 解析）與型別：`cd backend && npm install cookie-parser && npm install -D @types/cookie-parser`
- [x] T003 [P] 確認前端相依套件已包含 `axios`、`@tanstack/react-query`、`clsx`、`tailwind-merge`、`lucide-react`、`date-fns`；若缺則於 `frontend/` 補齊
- [x] T004 [P] 安裝並設定 OpenAPI 3.2 型別產生工具於 `frontend/package.json`：`npm install -D openapi-typescript`；並於 `frontend/package.json` 加入 script `"api:types": "openapi-typescript ../specs/001-auth-module/contracts/auth.openapi.yaml -o src/types/auth-api.d.ts"`
- [x] T005 [P] 安裝 OpenAPI 3.2 規格 lint 工具於 repo 根：`npm install -D @redocly/cli`；於根 `package.json` 加入 script `"lint:openapi": "redocly lint specs/001-auth-module/contracts/auth.openapi.yaml"`
- [x] T006 [P] 安裝後端 contract-test 執行所需：`cd backend && npm install -D supertest @types/supertest openapi-request-validator`
- [x] T007 [P] 下載並嵌入弱密碼清單：於 `backend/scripts/build-weak-passwords.ts` 建立建置腳本，自 pinned SecLists commit 抓 `10-million-password-list-top-10000.txt`，輸出為 `backend/src/utils/weakPasswords.ts` 的 `export const WEAK_PASSWORDS: Set<string>`；加入 `backend/package.json` 的 `"prebuild": "tsx scripts/build-weak-passwords.ts"`（依研究 R-002）
- [x] T008 於 `.github/workflows/ci.yml`（建立若不存在）加入 job：`npm run lint:openapi` + `cd backend && npm run typecheck` + `cd frontend && npm run typecheck`（憲法 §Development Workflow）

---

## Phase 2：Foundational（阻擋性前置條件）

**Purpose**：所有 User Story 皆依賴此層；本 Phase 完成才能進入任一 Story phase。

**⚠️ CRITICAL**：Phase 2 未完成前不得開始任一 Story 的實作任務。

### 2A：資料層

- [x] T010 更新 Prisma schema 於 `backend/prisma/schema.prisma`：於 `User` 模型新增 `isActive Boolean @default(true)` 與 `passwordChangedAt DateTime @default(now())`（對照 [data-model.md](./data-model.md) §2.1）
- [x] T011 [P] 於 `backend/prisma/schema.prisma` 的 `LoginLog` 新增 3 個索引：`@@index([createdAt])`、`@@index([email, createdAt])`、`@@index([success, createdAt])`（對照 [data-model.md](./data-model.md) §2.3）
- [x] T012 產生 migration：`cd backend && DATABASE_URL="file:./data/vitashelf.db" npx prisma migrate dev --name auth_module`；驗證 `backend/prisma/migrations/YYYYMMDDHHMMSS_auth_module/migration.sql` 內容含 `ALTER TABLE "User" ADD COLUMN "isActive"` 與 `passwordChangedAt`（預設為 `'1970-01-01 00:00:00'` 以保留既有 session 不立即失效；若採預設 `CURRENT_TIMESTAMP` 則手動改為 epoch）
- [x] T013 執行 `cd backend && npx prisma generate` 更新 Prisma Client 型別

### 2B：密碼雜湊與弱密碼檢查

- [x] T014 [P] 建立 `backend/src/utils/password.ts`：匯出 `hashPassword(plain: string): Promise<string>`、`verifyPassword(plain: string, hash: string): Promise<boolean>`、`isWeakPassword(plain: string): boolean`；採 SHA-256 pre-hash + bcrypt(cost=12)（依 [research.md](./research.md) R-006）；`isWeakPassword` 讀 `weakPasswords.ts` 的 `WEAK_PASSWORDS` Set、以 `toLowerCase()` 後查詢
- [x] T015 [P] 單元測試 `backend/tests/unit/password.test.ts`：(1) `hashPassword` 回傳以 `$2` 開頭 / 長度 60 字串；(2) `verifyPassword` 正確密碼回 `true`、錯誤回 `false`；(3) 超過 72 byte 的 UTF-8 密碼能成功 hash + verify（驗證 pre-hash 運作）；(4) `isWeakPassword("password123")` 為 `true`、`isWeakPassword("Str0ngP@ss!Xyz")` 為 `false`

### 2C：JWT 與 cookie

- [x] T016 [P] 建立 `backend/src/utils/jwt.ts`：匯出 `signToken(payload)`、`verifyToken(token)`、`authCookieSetHeader(token)`、`clearAuthCookieHeader()`；algorithm 固定 `HS256`、`expiresIn: '7d'`；cookie 選項固定 `{ httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 604800000 }`（依 [research.md](./research.md) R-005）
- [x] T017 [P] 單元測試 `backend/tests/unit/jwt.test.ts`：(1) `signToken` + `verifyToken` round-trip；(2) 以 `algorithms: ['HS256']` 拒絕 `alg: none`；(3) 過期 token 拋擲 `TokenExpiredError`；(4) `authCookieSetHeader` 輸出含 `HttpOnly; Secure; SameSite=Strict; Max-Age=604800`

### 2D：Middleware

- [x] T018 修改 `backend/src/middleware/auth.ts`：改為從 `req.cookies.token` 讀取（不再吃 `Authorization` header，FR-012）；驗證 JWT 通過後 `prisma.user.findUnique` 讀取 user；比對 `payload.iat * 1000 >= user.passwordChangedAt.getTime() - 60_000`（60 秒時鐘偏差）；不符則 401「憑證已失效，請重新登入」
- [x] T019 [P] 建立 `backend/src/middleware/csrf.ts`：匯出 `requireSameOrigin` middleware；對非 GET/HEAD/OPTIONS 請求檢查 `Origin` header（缺失則 fallback 至 `Referer`）是否在 `CORS_ORIGIN` 環境變數白名單；不符回 403「請求來源不被允許」（依 [research.md](./research.md) R-001）
- [x] T020 [P] 強化 `backend/src/middleware/rateLimit.ts`：登入專用 `loginRateLimit` 使用 `express-rate-limit` `MemoryStore`，`windowMs: 60_000`、`max: 5`、`skipSuccessfulRequests: true`、`standardHeaders: 'draft-7'`、custom `handler` 送 `Retry-After` header + body `{ message, retryAfterSeconds }` + 寫 LoginLog `reason: "rate_limited"`（依 [research.md](./research.md) R-007）
- [x] T021 於 `backend/src/index.ts` 註冊全域 middleware：`app.use(cookieParser())`、`app.use('/api/auth', requireSameOriginForNonGet)`、`app.use('/api/users', requireSameOriginForNonGet)`；並於 CORS 設定的 `exposedHeaders` 陣列加入 `'Retry-After'`（對應 FR-023b）

### 2E：稽核寫入與 cleanup scheduler

- [x] T022 [P] 建立 `backend/src/utils/loginLog.ts`：匯出 `writeLoginLog(params): Promise<void>`，內部包 `try/catch`；失敗時 `logger.error('loginlog_write_failed', { ...params, error })`，**不** 重拋（fail-open，FR-028d/e）；參數含 `userId?`、`email`、`ip`、`country`、`method`、`success`、`reason?`
- [x] T023 [P] 建立 `backend/src/schedulers/loginLogCleanup.ts`：匯出 `startLoginLogCleanupScheduler(prisma, logger)`；使用 `node-cron.schedule('0 19 * * *', ..., { timezone: 'UTC' })`；執行 `prisma.loginLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86400_000) } } })`；成功 `logger.info('loginlog_cleanup_completed', { deletedCount, durationMs })`、失敗 `logger.warn('loginlog_cleanup_failed', { error })`（依 [research.md](./research.md) R-003）
- [x] T024 於 `backend/src/index.ts` 啟動 Express 後呼叫 `startLoginLogCleanupScheduler(prisma, logger)`；並新增 npm script `"scheduler:loginlog-cleanup:now": "tsx -e \"import('./src/schedulers/loginLogCleanup').then(m => m.runCleanupOnce(...))\""` 供手動觸發驗證

### 2F：前端基礎

- [x] T025 [P] 更新 `frontend/src/services/api.ts`：Axios 實例 `withCredentials: true`；response interceptor 處理 401（除了 `/users/me` 自身）時 `queryClient.clear() + window.location.href = '/login'`（依 [research.md](./research.md) R-008）
- [x] T026 [P] 建立 `frontend/src/hooks/useAuth.ts`：以 TanStack Query 讀 `GET /api/users/me`、`retry: false`、`staleTime: 5 * 60_000`；匯出 `useAuth()` 與 `useLogin()`、`useLogout()`、`useRegister()`、`useChangePassword()` mutations
- [x] T027 [P] 執行 `cd frontend && npm run api:types` 產生 `frontend/src/types/auth-api.d.ts`；於 `frontend/tsconfig.json` 確認此檔案在 `include` 範圍；於 `services/auth.ts` 匯入型別

**Checkpoint**：Phase 2 完成 → 所有 User Story 可並行開始。

---

## Phase 3：User Story 1 — 註冊新帳號（Priority: P1） 🎯 MVP

**Goal**：新訪客以 email + 密碼 + displayName 建立帳號；公開註冊關閉時明確拒絕。

**Independent Test**：[quickstart.md](./quickstart.md) §2.1 — `POST /api/auth/register` 以合法輸入回 201 + User；資料庫可查到記錄；以 `registrationOpen=false` 情境回 403。

### Contract Test（先寫測試使其失敗，再實作）

- [x] T028 [P] [US1] 於 `backend/tests/contract/auth-register.contract.test.ts` 撰寫契約測試：以 `supertest` 打 `POST /api/auth/register` × 4 情境（201 成功、400 email 格式、400 密碼長度、409 重複 email）；以 `openapi-request-validator` 載入 `specs/001-auth-module/contracts/auth.openapi.yaml` 驗證 request + response 結構完全符合規格

### Integration Test

- [x] T029 [P] [US1] 於 `backend/tests/integration/auth-register.test.ts` 撰寫整合測試：對應 [spec.md](./spec.md) US1 驗收情境 1~5（成功註冊、註冊關閉、重複 email、email 格式錯、弱密碼命中 top-10k 清單）；每情境驗證 (a) HTTP status；(b) message；(c) 資料庫狀態（成功 → User 存在、失敗 → 未建立）

### Implementation

- [x] T030 [P] [US1] 於 `backend/src/routes/auth.ts` 實作 `POST /api/auth/register` handler（若檔案已存在則重寫 register 段）：
  - express-validator chain：email trim+lowercase+isEmail、password minLength 8 + `!isWeakPassword(v)`、displayName trim + 1-50 字
  - 讀 `AdminSettings.registrationOpen`，`false` → 403 `{ message: "目前不開放註冊" }`
  - 檢查 `User.email` 唯一 → 409 `{ message: "帳號已存在" }`
  - `hashPassword(password)` + `prisma.user.create`
  - 201 回傳 `{ user }`（不含 password / passwordChangedAt / googleId）
- [x] T031 [US1] 更新 `frontend/src/pages/Register.tsx`：
  - 以 React Hook Form + zod（或 express-validator 結構對應）做前端驗證
  - 密碼欄位 onBlur 顯示強度提示；收到 400 `errors[].path === 'password'` message 含「過於常見」時 inline 顯示
  - 成功 201 後導向 `/login` 頁（而非自動登入）
- [x] T032 [P] [US1] 更新 `frontend/src/services/auth.ts` 加入 `register(req)` 函式：`api.post('/api/auth/register', req).then(r => r.data.user)`

**Checkpoint**：US1 可獨立驗收（quickstart §2.1）。

---

## Phase 4：User Story 2 — 登入並取得 cookie（Priority: P1）

**Goal**：已註冊使用者以 email + 密碼登入；成功時下發 httpOnly cookie；回應 body 不含 token 明文。

**Independent Test**：[quickstart.md](./quickstart.md) §2.2 + §2.3 — 登入 200 + `Set-Cookie`；隨後以 cookie 存取 `/api/users/me` 回 200。

### Contract Test

- [ ] T033 [P] [US2] 於 `backend/tests/contract/auth-login.contract.test.ts` 撰寫契約測試：`POST /api/auth/login` × 5 情境（200 成功 + 驗證 Set-Cookie header 格式、400 輸入錯、401 帳號或密碼錯、403 帳號停用、200 回應無 `token` 欄位）

### Integration Test

- [x] T034 [P] [US2] 於 `backend/tests/integration/auth-login.test.ts` 撰寫整合測試：對應 US2 驗收情境 1~4（正確登入、錯誤密碼、帳號不存在回傳同樣 401 訊息、7 天又 1 分鐘後 cookie 失效）；使用 fake timer 模擬時間
- [ ] T035 [P] [US2] 於 `backend/tests/integration/auth-login-timing.test.ts` 撰寫時序一致性測試（SC-006）：對 1000 次「帳號存在+錯誤密碼」vs「帳號不存在」量測回應時間，以 Mann-Whitney U 檢定 p > 0.05

### Implementation

- [x] T036 [US2] 於 `backend/src/routes/auth.ts` 實作 `POST /api/auth/login`（套用 `loginRateLimit` middleware 以 inline `router.post('/login', loginRateLimit, handler)`）：
  - express-validator：email trim+lowercase+isEmail、password notEmpty
  - `prisma.user.findUnique({ where: { email } })` 查使用者；為 `null` 時仍執行 dummy `verifyPassword` 比對固定 hash 確保時序一致（對應 SC-006），之後回 401
  - `verifyPassword` 失敗 → 寫 LoginLog `reason: "wrong_password"` → 401
  - `user.isActive === false` → 寫 LoginLog `reason: "account_disabled"` → 403 `{ message: "帳號已被停用" }`
  - 成功 → `signToken({ userId, email, role })`、`res.setHeader('Set-Cookie', authCookieSetHeader(token))`、寫 LoginLog `success: true, reason: null`、回 `{ user }`
- [ ] T037 [P] [US2] 更新 `frontend/src/pages/Login.tsx`：
  - React Hook Form 表單（email、password）
  - `useLogin()` mutation 成功後 `queryClient.invalidateQueries(['me'])` 並 `navigate('/')`（儀表板）
  - 401 顯示「帳號或密碼錯誤」toast
- [ ] T038 [P] [US2] 更新 `frontend/src/services/auth.ts` 加入 `login(req)`：`api.post('/api/auth/login', req).then(r => r.data.user)`

**Checkpoint**：US2 可獨立驗收（quickstart §2.2、§2.3）。

---

## Phase 5：User Story 3 — 登出並清除 cookie（Priority: P1）

**Goal**：登出清除當前裝置 cookie；不維護黑名單。

**Independent Test**：登入後呼叫登出；隨後 `GET /api/users/me` 回 401。

### Contract Test

- [ ] T039 [P] [US3] 於 `backend/tests/contract/auth-logout.contract.test.ts` 撰寫契約測試：`POST /api/auth/logout` × 2 情境（200 + Set-Cookie Max-Age=0、401 未登入）

### Integration Test

- [x] T040 [P] [US3] 於 `backend/tests/integration/auth-logout.test.ts` 撰寫整合測試：對應 US3 驗收情境 1~2（裝置 A 登出清 cookie、裝置 B cookie 仍有效）

### Implementation

- [x] T041 [US3] 於 `backend/src/routes/auth.ts` 實作 `POST /api/auth/logout`（套用 `authenticate` + `requireSameOrigin` middleware）：`res.setHeader('Set-Cookie', clearAuthCookieHeader())` → 200 `{ message: "已登出" }`
- [ ] T042 [P] [US3] 前端 logout 按鈕：於 `frontend/src/components/Sidebar.tsx`（或相應導航元件）綁定 `useLogout()` mutation；成功後 `queryClient.clear()` + `navigate('/login')`
- [ ] T043 [P] [US3] 更新 `frontend/src/services/auth.ts` 加入 `logout()`：`api.post('/api/auth/logout').then(() => {})`

**Checkpoint**：US3 可獨立驗收。

---

## Phase 6：User Story 4 — 取得與更新個人資料（Priority: P2）

**Goal**：讀取自己的 User；更新 displayName / theme；其他欄位不可由此路徑修改。

**Independent Test**：登入後 GET /me 回 User（無密碼欄位）；PUT /me 更新後再 GET 確認持久化。

### Contract Test

- [ ] T044 [P] [US4] 於 `backend/tests/contract/users-me.contract.test.ts` 撰寫契約測試：`GET /api/users/me` + `PUT /api/users/me` 所有 status code 情境；驗證回應 schema 不含 password / passwordChangedAt / googleId

### Integration Test

- [ ] T045 [P] [US4] 於 `backend/tests/integration/users-me.test.ts` 撰寫整合測試：對應 US4 驗收情境 1~3（取得 me、更新 displayName+theme、嘗試改 role/email 被忽略）

### Implementation

- [ ] T046 [US4] 於 `backend/src/routes/auth.ts`（或 `backend/src/routes/users.ts` 若要分檔）實作 `GET /api/users/me`：`prisma.user.findUnique({ where: { id: req.user!.userId }, select: { ... 白名單 ... } })`；`authenticate` middleware
- [ ] T047 [US4] 於同檔案實作 `PUT /api/users/me`（`authenticate` + `requireSameOrigin`）：
  - express-validator 只允許 `displayName`（optional, trim, 1-50）+ `theme`（optional, isIn ['light','dark']）
  - `prisma.user.update` 只 set 白名單欄位
  - 200 回更新後 User
- [ ] T048 [P] [US4] 更新 `frontend/src/pages/Settings.tsx`：個人資料區塊（displayName + theme 切換）；使用 `useMutation` 呼叫 `PUT /users/me`；成功後 `queryClient.setQueryData(['me'], user)`
- [ ] T049 [P] [US4] 更新 `frontend/src/services/auth.ts` 加入 `updateMe(req)`：`api.put('/api/users/me', req).then(r => r.data)`

**Checkpoint**：US4 可獨立驗收。

---

## Phase 7：User Story 5 — 密碼變更（Priority: P2）

**Goal**：驗證舊密碼通過後於 transaction 更新密碼與 `passwordChangedAt`；強制所有裝置重新登入。

**Independent Test**：[quickstart.md](./quickstart.md) §6 — 兩裝置登入狀態下變更密碼；裝置 A 收 Set-Cookie Max-Age=0；裝置 B 下次 /me 請求回 401。

### Contract Test

- [ ] T050 [P] [US5] 於 `backend/tests/contract/change-password.contract.test.ts` 撰寫契約測試：`POST /api/users/me/change-password` × 4 情境（200 + Set-Cookie 清除、400 弱密碼、400 長度不足、401 舊密碼錯）

### Integration Test

- [ ] T051 [P] [US5] 於 `backend/tests/integration/change-password.test.ts` 撰寫整合測試：對應 US5 驗收情境 1~4（成功變更後舊密碼無法登入、跨裝置 cookie 全失效、舊密碼錯誤時 DB 未改動、新密碼驗證失敗時 DB 未改動）
- [ ] T052 [P] [US5] 於 `backend/tests/integration/password-change-atomic.test.ts` 驗證 FR-020a：於 `bcrypt.hash` mock 拋例外的情境下，`User.password` 與 `User.passwordChangedAt` 皆未改動

### Implementation

- [ ] T053 [US5] 於 `backend/src/routes/auth.ts` 實作 `POST /api/users/me/change-password`（`authenticate` + `requireSameOrigin`）：
  - express-validator：`oldPassword` notEmpty、`newPassword` minLength 8 + `!isWeakPassword(v)`
  - 讀 User、`verifyPassword(oldPassword, user.password)` 失敗 → 401
  - `prisma.$transaction(async tx => { await tx.user.update({ where: { id }, data: { password: newHash, passwordChangedAt: new Date() } }) })`
  - `res.setHeader('Set-Cookie', clearAuthCookieHeader())` → 200 `{ message: "密碼已更新，請重新登入" }`
- [ ] T054 [P] [US5] 更新 `frontend/src/pages/Settings.tsx` 加入密碼變更區塊：表單（oldPassword、newPassword、confirmNewPassword 前端比對一致）；成功後 `queryClient.clear() + navigate('/login')`；顯示提示「密碼已更新，請以新密碼重新登入」
- [ ] T055 [P] [US5] 更新 `frontend/src/services/auth.ts` 加入 `changePassword(req)`

**Checkpoint**：US5 可獨立驗收；跨裝置失效可由 T051 自動驗證 + quickstart §6 手動驗證。

---

## Phase 8：User Story 6 — 登入限流與稽核（Priority: P2）

**Goal**：同 IP 每分鐘第 6 次失敗即 429 + `Retry-After` + `retryAfterSeconds`；所有登入事件寫 LoginLog；寫入失敗 fail-open + error log；90 天保留。

**Independent Test**：[quickstart.md](./quickstart.md) §3、§4、§9 — 連續 6 次登入失敗、驗 LoginLog 完整性、人工插入 91 天資料 → cron 清除。

### Contract Test

- [ ] T056 [P] [US6] 於 `backend/tests/contract/auth-login-rate-limit.contract.test.ts` 撰寫契約測試：驗證 429 回應符合 `RateLimitedResponse` schema、`Retry-After` header 為整數、`retryAfterSeconds` 與 header 一致

### Integration Test

- [x] T057 [P] [US6] 於 `backend/tests/integration/rate-limit.test.ts`：連發 6 次錯密碼請求；驗證第 1~5 次 401、第 6 次 429；第 6 次回應時間 < 30 ms（不觸發 bcrypt）；LoginLog 有 5 筆 `wrong_password` + 1 筆 `rate_limited`；不同 IP 不受影響
- [ ] T058 [P] [US6] 於 `backend/tests/integration/loginlog-completeness.test.ts`：對應 SC-004；逐一觸發 6 種失敗情境（wrong_password、email_not_found、rate_limited、registration_closed、validation_error、account_disabled）+ 1 次成功；驗證每筆 LoginLog 欄位完整度 100%（`ip`、`country`、`method` 非 null/空字串）
- [ ] T059 [P] [US6] 於 `backend/tests/integration/loginlog-fail-open.test.ts`：mock `prisma.loginLog.create` 拋例外；驗證 (a) 登入成功仍回 200 + 下發 cookie；(b) winston 有 `event: "loginlog_write_failed"` 結構化 log（對應 FR-028d/e）
- [ ] T060 [P] [US6] 於 `backend/tests/integration/loginlog-cleanup.test.ts`：插入 100 筆 `createdAt = now - 91d` 的 LoginLog；呼叫 `runCleanupOnce()`；驗證殘留 0 筆 + winston 有 `deletedCount: 100`
- [ ] T061 [P] [US6] 於 `backend/tests/integration/password-hash-format.test.ts` 對應 SC-005：註冊 10 個使用者後，以原始 SQL 查 `User.password`，驗證全部符合 `^\\$2[aby]\\$\\d{2}\\$.{53}$` 且長度 60

### Implementation

- [ ] T062 [US6] 確認 `backend/src/routes/auth.ts` 的 `/login` 路由已套用 `loginRateLimit` middleware（T020 成果）；429 handler 內呼叫 `writeLoginLog({ reason: "rate_limited", success: false, email: req.body.email ?? '' })`
- [ ] T063 [P] [US6] 於 `frontend/src/pages/Login.tsx` 加入 429 倒數 UX：
  - 收到 429 時從 response body 讀 `retryAfterSeconds`
  - `useState` + `useEffect` 以 `setInterval(tick, 1000)` 遞減
  - 按鈕 `disabled` 至倒數為 0；按鈕文字顯示「請稍後再試（`{remaining}` 秒）」
  - 若倒數 = 0 則恢復可用

**Checkpoint**：US6 可獨立驗收；SC-003 / SC-004 / SC-005 / SC-010 皆有自動化測試覆蓋。

---

## Phase N：Polish & Cross-Cutting Concerns

**Purpose**：跨 Story 的清理與交付閘門。

- [ ] T064 [P] 確認所有新 router 皆有 inline `router.use(rateLimit(...))`（憲法 Principle IV + CodeQL js/missing-rate-limiting）；`backend/src/routes/auth.ts` 於檔案頂端 inline 套用 router-wide read 限流
- [ ] T065 [P] 跑 CodeQL 本地掃描（若有 `gh` CLI + CodeQL extension）或等待 GitHub Action 報告；解決所有 high/critical 警告
- [ ] T066 [P] 更新 [`SRS.md`](../../SRS.md) §3.1（認證模組）以對應本模組最終實作（`isActive`、`passwordChangedAt`、429 合約、90 天保留、NIST 密碼政策）
- [ ] T067 [P] 更新 [`changelog.json`](../../changelog.json) + [`VERSION`](../../VERSION) 以語意化版本升級（新功能 → MINOR，建議 `v2.5.0`）
- [ ] T068 [P] 更新 [`README.md`](../../README.md) 若有環境變數新增（本模組未新增必要環境變數，檢視後無需改動則跳過）
- [ ] T069 手動執行 [`quickstart.md`](./quickstart.md) §1 ~ §12 所有步驟；記錄實際回應與預期差異；任一差異開 issue 修正
- [ ] T070 `npm run lint:openapi` 綠燈；於 PR 描述貼出 redocly 輸出
- [ ] T071 前端 / 後端 `npm run typecheck` 綠燈（憲法 Principle III）；於 PR 描述貼出輸出
- [ ] T072 跑全套 test：`cd backend && npm test`；所有 contract / integration / unit test 綠燈
- [ ] T073 [P] 驗證 **SC-007 / FR-010（JWT_SECRET 自動警示）**：於 `backend/tests/integration/jwt-secret-warn.test.ts` 以 `child_process.spawn` 啟動後端行程（`env` 中 unset `JWT_SECRET` + 保留 `DATABASE_URL`）；斷言 (a) stderr 或 stdout 在 `15_000` ms 內出現 `WARNING: JWT_SECRET not set` 字串；(b) 啟動完成後對 `POST /api/auth/login` 模擬合法登入可成功取得 cookie（token 使用自動生成的 secret 仍正常簽發與驗證）；(c) 測試結束以 `child.kill('SIGTERM')` 清理避免 orphaned process。若既有實作位於 `docker-entrypoint.sh`（僅於容器內有效），則 Node 層 `utils/jwtSecret.ts` 需同步提供 fallback 以使本整合測試可於非 Docker 環境執行

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**：無前置依賴；可立即開始
- **Phase 2 Foundational**：依賴 Phase 1 完成；**阻擋所有 Story**
- **Phase 3 ~ Phase 8（各 User Story）**：依賴 Phase 2 完成；互不阻擋，可並行
- **Phase N Polish**：依賴所有要交付的 Story 完成

### User Story 內部順序

1. Contract test + Integration test **先寫並確認失敗**
2. Models / Utils 先於 Services
3. Services / Middleware 先於 Route handlers
4. Backend 路由完成後前端才能整合（但前端 UI skeleton 可平行進行）

### 並行機會

- T002 / T003 / T004 / T005 / T006 / T007（不同套件 / 不同檔案）
- T011（schema 索引）與 T010（schema 欄位）在 `schema.prisma` 同檔，**不可** 並行
- T014（utils/password.ts）/ T016（utils/jwt.ts）/ T019（csrf.ts）/ T020（rateLimit.ts）皆不同檔，可並行
- 各 Story 的 contract test / integration test / frontend service / page 皆不同檔，可並行
- Phase N 的 T064 ~ T068 大部分可並行

---

## Parallel Example：Phase 2 Foundational

```text
# 同一時段可平行啟動的任務（不同檔案、無依賴）：
T014 [backend/src/utils/password.ts]        + T015 [tests/unit/password.test.ts]
T016 [backend/src/utils/jwt.ts]             + T017 [tests/unit/jwt.test.ts]
T019 [backend/src/middleware/csrf.ts]
T020 [backend/src/middleware/rateLimit.ts]
T022 [backend/src/utils/loginLog.ts]
T023 [backend/src/schedulers/loginLogCleanup.ts]
T025 [frontend/src/services/api.ts]
T026 [frontend/src/hooks/useAuth.ts]
T027 [frontend/src/types/auth-api.d.ts]     (由 T004 script 產生)
```

T010 → T011 → T012 → T013 為 schema 序列，無法並行（同檔 schema.prisma + migration 依賴 generate）。

T018 依賴 T013（Prisma Client 型別）與 T016（jwt util）。

T024 依賴 T023（scheduler 匯出）與 T021（index.ts mount）。

## Parallel Example：User Story 1（註冊）

```text
# 可同時啟動：
T028 contract test         [tests/contract/auth-register.contract.test.ts]
T029 integration test      [tests/integration/auth-register.test.ts]
T032 frontend service      [frontend/src/services/auth.ts 的 register()]
```

T030（route handler）不可與 T028/T029 並行，因 TDD 要求測試先失敗。
T031（frontend page）依賴 T032（service），且 UI 與 backend API 通訊需 T030 綠燈才能端對端驗證。

---

## Implementation Strategy

### MVP 路徑（最小可交付 = US1 + US2 + US3）

1. 完成 Phase 1 Setup（T001 ~ T008）
2. 完成 Phase 2 Foundational（T010 ~ T027）— **關鍵阻擋點**
3. 完成 Phase 3 US1 註冊（T028 ~ T032）→ **STOP 驗收**（quickstart §2.1）
4. 完成 Phase 4 US2 登入（T033 ~ T038）→ **STOP 驗收**（quickstart §2.2、§2.3）
5. 完成 Phase 5 US3 登出（T039 ~ T043）→ **STOP 驗收**

此刻可部署 MVP，使用者已能完整使用庫存模組（需登入的所有既有功能）。

### 增量交付

6. 補 Phase 6 US4 個人資料（個人化）
7. 補 Phase 7 US5 密碼變更（安全維運）
8. 補 Phase 8 US6 限流 + 稽核（正式營運必需）
9. 進入 Phase N Polish → 合併 PR → release

### 並行團隊策略

若有 2 位開發者：
- 完成 Phase 1 + 2 後
- **Dev A**：Phase 3 US1 + Phase 4 US2 + Phase 5 US3（使用者入口三連）
- **Dev B**：Phase 6 US4 + Phase 7 US5 + Phase 8 US6（個人資料 + 安全）

兩人於 Phase 8 T062 對 `loginRateLimit` 的整合點對齊即可；其餘任務皆為獨立檔案。

---

## Notes

- [P] = 不同檔案、無依賴，可並行啟動
- [US1] ~ [US6] 用於追溯至 [spec.md](./spec.md) 的 User Story
- 所有 contract test 皆以 `openapi-request-validator` 載入 [`contracts/auth.openapi.yaml`](./contracts/auth.openapi.yaml) 作為合約事實來源（憲法 Principle II）
- 每個 checkpoint 處可停下來驗收、部署、示範；不必等全部 Story 完成才交付
- 提交 commit 建議以「`feat(auth): [T0XX] <description>`」或依 Conventional Commits 規範（憲法 §Development Workflow）
- 禁止：跨 Story 的隱性耦合（某 Story 的實作在另一 Story 的檔案裡）；同一檔案的並行修改；無 file path 的模糊任務
