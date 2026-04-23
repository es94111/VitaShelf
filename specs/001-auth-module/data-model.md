# 資料模型：認證模組（Auth Module）

**Branch**: `001-auth-module` | **Date**: 2026-04-23 | **Plan**: [plan.md](./plan.md)

> 本檔記錄本模組對 Prisma schema 的異動、對應的 SQLite migration、以及每個欄位的驗證規則與狀態轉換。所有欄位名沿用英文作為程式識別子（憲法 Principle I 之例外）。

---

## 1. 實體概觀

本模組涉及 **2 張資料表**：

| 表名 | 所屬模組 | 本模組的存取權 |
|------|----------|----------------|
| `User` | 認證模組 | 讀寫（建立、讀取、更新 `password`/`theme`/`displayName`/`passwordChangedAt`；**不** 寫 `role`、`email` 於 profile 路徑） |
| `LoginLog` | 認證模組 | 寫入（每次登入嘗試）、讀取（本模組不查詢，由管理員模組查詢）、刪除（`node-cron` 排程） |
| `AdminSettings` | 管理員模組 | **唯讀**（註冊前檢查 `registrationOpen`） |

---

## 2. Prisma Schema 異動

### 2.1 `User` 表擴充

既有 schema（[backend/prisma/schema.prisma](../../backend/prisma/schema.prisma)）於本模組新增 **2 個欄位**：

```prisma
model User {
  id                 String   @id @default(cuid())
  email              String   @unique
  password           String
  displayName        String
  role               String   @default("USER")
  theme              String   @default("light")
  authProvider       String   @default("LOCAL")
  googleId           String?  @unique
  isActive           Boolean  @default(true)              // ★ 新增（Clarification Q2）
  passwordChangedAt  DateTime @default(now())             // ★ 新增（Clarification Q7）
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  products  Product[]
  tags      Tag[]
  loginLogs LoginLog[]
}

// Role:         "ADMIN" | "USER" | "VIEWER"
// AuthProvider: "LOCAL" | "GOOGLE"
```

**欄位說明**：

| 欄位 | 類型 | 預設值 | 驗證規則 | 對應 FR |
|------|------|--------|----------|---------|
| `email` | `String` (unique) | — | `trim + lowercase` 後須符合 RFC 5322；長度 ≤ 254 | FR-002、FR-003a |
| `password` | `String` | — | bcrypt 雜湊（`$2[aby]$` 開頭、長度 60），經 SHA-256 pre-hash（R-006） | FR-006 |
| `displayName` | `String` | — | `trim()` 後非空；1 ~ 50 字 | FR-005 |
| `role` | `String` | `"USER"` | enum：`ADMIN` / `USER` / `VIEWER`；本模組不可寫 | — |
| `theme` | `String` | `"light"` | enum：`light` / `dark` | FR-017 |
| `authProvider` | `String` | `"LOCAL"` | enum：`LOCAL` / `GOOGLE` | — |
| `googleId` | `String?` (unique) | `null` | 由 Google SSO 模組寫入 | —（跨模組） |
| `isActive` ★ | `Boolean` | `true` | 由管理員模組切換；本模組登入時讀取 | FR-011a |
| `passwordChangedAt` ★ | `DateTime` | `now()` | UTC；每次密碼變更於 transaction 中更新；JWT 驗證比對 | FR-012b、FR-020a |
| `createdAt` | `DateTime` | `now()` | 系統維護 | — |
| `updatedAt` | `DateTime` | — (auto) | 系統維護 | — |

### 2.2 `LoginLog` 表

既有 schema 無須異動；欄位 **完整保留**（保留期由應用層 `node-cron` 處理，非 schema 層）：

```prisma
model LoginLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  email     String
  ip        String
  country   String   @default("")
  method    String   @default("local")
  success   Boolean
  reason    String?
  createdAt DateTime @default(now())
}
```

**欄位說明**：

| 欄位 | 類型 | 驗證規則 | 對應 FR |
|------|------|----------|---------|
| `userId` | `String?` | 可 null（email 未註冊 / 限流情境） | FR-024、FR-025 |
| `email` | `String` | 使用者送出的 email 經 `trim + lowercase` 後的值 | FR-026 |
| `ip` | `String` | 請求來源 IP（IPv4 / IPv6）；**必填** | FR-026 |
| `country` | `String` | ISO 3166-1 alpha-2；查不到為 `""`；**必填** | FR-026 |
| `method` | `String` | 本模組固定 `"local"`；Google SSO 模組會寫 `"google"` | FR-024 |
| `success` | `Boolean` | 登入是否成功 | FR-024、FR-025 |
| `reason` | `String?` | enum：`wrong_password` / `email_not_found` / `rate_limited` / `registration_closed` / `validation_error` / `account_disabled` / `null`（成功時） | FR-027 |
| `createdAt` | `DateTime` | 事件時間；保留 90 天 | FR-028a |

### 2.3 索引建議

為「90 天清除任務」與「管理員稽核查詢」的效能，建議新增索引：

```prisma
model LoginLog {
  // ... 欄位省略
  @@index([createdAt])              // 清除任務: WHERE createdAt < X
  @@index([email, createdAt])       // 管理員查某帳號的登入歷史
  @@index([success, createdAt])     // 管理員查全站失敗事件
}
```

---

## 3. SQLite Migration SQL

於 `backend/prisma/migrations/20260423HHMMSS_auth_module/migration.sql`（由 `prisma migrate dev --name auth_module` 產生，預期內容如下）：

```sql
-- ★ 新增 User.isActive（Clarification Q2）
-- SQLite 不支援 ALTER ADD COLUMN WITH NOT NULL + DEFAULT 的原子性同時操作，
-- Prisma 會自動處理（建立暫存表、複製、交換）。
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- ★ 新增 User.passwordChangedAt（Clarification Q7）
-- 既有使用者預設為帳號建立時間（= createdAt），以免舊 token 立即失效
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ★ LoginLog 索引（效能）
CREATE INDEX "LoginLog_createdAt_idx" ON "LoginLog"("createdAt");
CREATE INDEX "LoginLog_email_createdAt_idx" ON "LoginLog"("email", "createdAt");
CREATE INDEX "LoginLog_success_createdAt_idx" ON "LoginLog"("success", "createdAt");
```

**遷移風險與緩解**：
- `isActive` 預設 `true`：既有使用者不受影響。
- `passwordChangedAt` 預設 `CURRENT_TIMESTAMP`：既有使用者的 JWT `iat` 會 **小於** 新設的 `passwordChangedAt`（因為 JWT 是 migration 前簽發、`passwordChangedAt` 是 migration 後設定）——這會導致 **所有既有 session 於 migration 後立即失效**。於生產環境需於 release note 明告；開發環境目前無使用者資料，影響可忽略。
- 緩解（若要保留既有 session）：migration 手動修改為 `... DEFAULT '1970-01-01 00:00:00'`；但 spec US5 要求「變更密碼後全裝置失效」，從 epoch 開始本身並不破壞此語意（任何 JWT 都會 > epoch），可安全採用。

**建議最終形式**：

```sql
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';
```

---

## 4. 狀態轉換

### 4.1 `User.isActive`

```
┌──────────┐      管理員停用      ┌──────────┐
│ true     │ ─────────────────► │ false    │
│ (可登入) │                    │ (拒絕登入)│
└──────────┘ ◄───────────────── └──────────┘
                管理員重新啟用
```

- 轉換由管理員模組（`PATCH /api/admin/users/:id`）負責。
- 本模組僅於 `POST /api/auth/login` 與 `middleware/auth.ts` 的 JWT 驗證**讀取** `isActive`；讀到 `false` 時：
  - 登入路徑：返回 `403 account_disabled` + 寫 LoginLog
  - JWT 驗證：返回 `401 憑證已失效`（因為帳號停用後使用者的 cookie 仍存在至過期或密碼變更；spec Edge Case 明示此為已知接受範圍）

> **實作註記**：本模組 **不** 要求於 JWT middleware 比對 `isActive`（因檢查 `passwordChangedAt` 已足夠處理「停用後使用者無法改密碼→無法阻擋現有 session」的情境）。若管理員要立即撤銷某停用使用者的現有 cookie，需手動呼叫「重設密碼」或等待 cookie 自然過期（屬 Edge Case 明列之已知接受範圍）。

### 4.2 `User.passwordChangedAt`

```
┌───────────────────┐  密碼變更成功  ┌───────────────────┐
│ prev (已簽發 JWT) │ ────────────► │ now() (於 txn 內) │
└───────────────────┘               └───────────────────┘
         │                                    │
         │ JWT 驗證時 jwt.iat >= passwordChangedAt?
         ▼                                    ▼
       true                                 false
    (允許存取)                          (401 憑證已失效)
```

- 更新點：`POST /api/users/me/change-password` 成功時，於同一 Prisma transaction 中更新 `password` + `passwordChangedAt`。
- 讀取點：`middleware/auth.ts` 每次受保護請求。

---

## 5. 衍生型別（前端 TypeScript）

由 `openapi-typescript` 從 `contracts/auth.openapi.yaml` 自動產生，無需手刻。常用型別預覽：

```ts
// 由 OpenAPI 產生
export interface User {
  id: string
  email: string
  displayName: string
  role: 'ADMIN' | 'USER' | 'VIEWER'
  authProvider: 'LOCAL' | 'GOOGLE'
  theme: 'light' | 'dark'
  isActive: boolean
  createdAt: string  // ISO 8601
  updatedAt: string
  // 絕不包含: password, passwordChangedAt, googleId
}

export interface LoginSuccessResponse {
  user: User
  // 注意：無 token 欄位（FR-008，token 於 Set-Cookie）
}

export interface RateLimitedResponse {
  message: string
  retryAfterSeconds: number
}

export type LoginFailureReason =
  | 'wrong_password'
  | 'email_not_found'
  | 'rate_limited'
  | 'registration_closed'
  | 'validation_error'
  | 'account_disabled'
```

---

## 6. 驗證整合（express-validator）

後端每個 endpoint 的 payload 驗證以 `express-validator` chain 宣告，對應 FR：

### `POST /api/auth/register`
```ts
[
  body('email').trim().toLowerCase().isEmail().withMessage('email 格式錯誤'),
  body('password').isString().isLength({ min: 8 }).withMessage('密碼至少需 8 字元')
    .custom((v) => !isWeakPassword(v)).withMessage('此密碼過於常見，請改用較不易被猜中的密碼'),
  body('displayName').trim().isLength({ min: 1, max: 50 }).withMessage('顯示名稱為必填'),
]
```

### `POST /api/auth/login`
```ts
[
  body('email').trim().toLowerCase().isEmail().withMessage('email 格式錯誤'),
  body('password').isString().notEmpty().withMessage('密碼為必填'),
]
// 密碼長度 / 弱密碼檢查不在登入階段做（避免 enumeration + 正規化差異導致合法使用者被擋）
```

### `PUT /api/users/me`
```ts
[
  body('displayName').optional().trim().isLength({ min: 1, max: 50 }),
  body('theme').optional().isIn(['light', 'dark']),
  // email, role, password 不被接受（express-validator 白名單外過濾）
]
```

### `POST /api/users/me/change-password`
```ts
[
  body('oldPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8 }).withMessage('密碼至少需 8 字元')
    .custom((v) => !isWeakPassword(v)).withMessage('此密碼過於常見'),
]
```

---

## 7. 不屬本模組的實體

本模組 **不** 定義或修改以下表：

- `AdminSettings`：由管理員模組擁有；本模組僅透過 `prisma.adminSettings.findUnique({ where: { id: 'singleton' } })` 讀取 `registrationOpen`。
- `Product` / `PurchaseRecord` / `StockLog` / `Tag` / `ProductTag`：完全不涉及。

---

## 8. 資料完整性測試要點

於 `/speckit.tasks` 階段需展開為具體任務。核心覆蓋：

- [ ] `User.email` 唯一性：併發兩個 register 以同 email，第二個須 `409`（migration 的 `@unique` 約束）
- [ ] `User.password` 永遠為 bcrypt 格式：以 SQL 直接查詢 `SELECT password FROM User WHERE password NOT LIKE '$2%' OR LENGTH(password) != 60;` 應為 0 筆（SC-005）
- [ ] `passwordChangedAt` atomic 更新：模擬 `bcrypt.hash` 擲例外時，資料庫中 `password` 未改動（FR-020a）
- [ ] `LoginLog.createdAt < now() - 90 days` 經 cron 後為 0 筆（SC-010）
- [ ] `LoginLog.ip / country / method` 於任何失敗紀錄皆非 `null`（FR-026）

以上測試於 tasks.md 中展開為契約測試（對應 OpenAPI spec）與整合測試（對應本 data-model）。
