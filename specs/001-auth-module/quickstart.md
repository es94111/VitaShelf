# 快速驗收：認證模組（Auth Module）

**Branch**: `001-auth-module` | **Date**: 2026-04-23 | **Plan**: [plan.md](./plan.md)

> 本檔提供本模組的本地一鍵啟動 + 手動驗收腳本；對應 [spec.md](./spec.md) §3 的 **SC-001 ~ SC-010**。
> 自動化 contract test / integration test 由 `/speckit.tasks` 階段展開至 `tasks.md`。

---

## 前置條件

- Windows 11 + Docker Desktop、或等效的 Linux / macOS + Docker Engine
- `curl`（Windows PowerShell 5.1 內建為 `Invoke-WebRequest` 的別名；本檔提供 bash `curl` 範例，PowerShell 使用者請用 `Invoke-RestMethod -SessionVariable`）
- 已切換至 `001-auth-module` 分支（由 `/speckit.specify` 建立）

---

## 1. 一鍵啟動本地開發環境

```bash
# 從專案根目錄執行
cd D:/SynologyDrive/網頁/保養品與保健食品庫存管理網頁

# 產生 .env（若尚未建立）；會自動生成隨機 JWT_SECRET
npm run setup:env

# 啟動 frontend + backend（SQLite 於 volume 內）
docker compose up -d

# 等待後端就緒（約 10 秒；首次執行會跑 prisma migrate deploy）
curl -fsS http://localhost:4000/health || echo "等待中..."
```

預期：
- Frontend：http://localhost:3000
- Backend（直接存取 API）：http://localhost:4000

---

## 2. 驗收 SC-001：新使用者 2 分鐘內完成註冊 + 登入 + 進儀表板

### 2.1 註冊（對應 US-1）

```bash
# 計時起點
date

curl -i -c cookies.txt -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "alice@example.com",
    "password": "Str0ngPassword!",
    "displayName": "Alice"
  }'
```

預期回應：
```
HTTP/1.1 201 Created
Content-Type: application/json

{"user":{"id":"cl...","email":"alice@example.com","displayName":"Alice","role":"USER","authProvider":"LOCAL","theme":"light","isActive":true,"createdAt":"...","updatedAt":"..."}}
```

**注意**：`Set-Cookie` **不** 於註冊回應下發（FR 未要求註冊後自動登入）。

### 2.2 登入（對應 US-2）

```bash
curl -i -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "alice@example.com",
    "password": "Str0ngPassword!"
  }'
```

預期回應：
```
HTTP/1.1 200 OK
Set-Cookie: token=eyJhbGciOiJIUzI1NiIs...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
Content-Type: application/json

{"user":{"id":"cl...","email":"alice@example.com",...}}
```

**關鍵驗證**（對應 FR-008 / FR-009）：
- ✅ `Set-Cookie` 包含 `HttpOnly`、`Secure`、`SameSite=Strict`、`Max-Age=604800`
- ✅ 回應 body **不** 含 `token` 欄位

### 2.3 存取受保護端點（對應 US-2 驗收情境 1）

```bash
curl -i -b cookies.txt http://localhost:4000/api/users/me
```

預期回應：
```
HTTP/1.1 200 OK
Content-Type: application/json

{"id":"cl...","email":"alice@example.com",...}
```

**計時終點**：整段若 < 120 秒 → SC-001 通過。

---

## 3. 驗收 SC-003：第 6 次登入被限流

對同一 IP 連續送 6 次錯誤密碼：

```bash
for i in 1 2 3 4 5 6; do
  echo "--- 嘗試 #$i ---"
  curl -i -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{"email":"alice@example.com","password":"wrong!!!"}' \
    -o /dev/null -w "HTTP=%{http_code}\n"
done
```

預期：
- 第 1~5 次：`HTTP=401`
- 第 6 次：`HTTP=429` + Response header `Retry-After: <seconds>` + body `{"message":"登入嘗試次數過多，請稍後再試","retryAfterSeconds":<n>}`

完整查看第 6 次回應：

```bash
curl -i -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"alice@example.com","password":"wrong!!!"}'
```

**關鍵驗證**（對應 FR-023a/b）：
- ✅ `Retry-After` header 與 body `retryAfterSeconds` 完全一致
- ✅ 此 429 回應 **不** 觸發 bcrypt 比對（耗時應 < 10 ms，vs 正常密碼比對約 100+ ms）

---

## 4. 驗收 SC-004 / FR-024 ~ FR-028：LoginLog 完整寫入

```bash
# 於容器內直接查 SQLite（或使用 prisma studio）
docker compose exec backend sh -c "node -e \"
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.loginLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }).then(r => console.log(JSON.stringify(r, null, 2)));
\""
```

預期（部分欄位）：
```json
[
  { "email": "alice@example.com", "ip": "...", "country": "...", "method": "local", "success": false, "reason": "rate_limited", ... },
  { "email": "alice@example.com", "ip": "...", "country": "...", "method": "local", "success": false, "reason": "wrong_password", ... },
  { "email": "alice@example.com", "ip": "...", "country": "...", "method": "local", "success": false, "reason": "wrong_password", ... },
  { "email": "alice@example.com", "ip": "...", "country": "...", "method": "local", "success": false, "reason": "wrong_password", ... },
  { "email": "alice@example.com", "ip": "...", "country": "...", "method": "local", "success": false, "reason": "wrong_password", ... },
  { "email": "alice@example.com", "ip": "...", "country": "...", "method": "local", "success": false, "reason": "wrong_password", ... },
  { "email": "alice@example.com", "ip": "...", "country": "...", "method": "local", "success": true,  "reason": null, ... }
]
```

**關鍵驗證**：
- ✅ 7 筆紀錄（1 次成功 + 5 次 wrong_password + 1 次 rate_limited）
- ✅ 每筆的 `ip`、`country`、`method` 均非 `null`
- ✅ 成功紀錄的 `reason` 為 `null`

---

## 5. 驗收 SC-005 / FR-006：密碼以 bcrypt 儲存

```bash
docker compose exec backend sh -c "node -e \"
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.findUnique({ where: { email: 'alice@example.com' }, select: { password: true } })
    .then(u => console.log('Hash:', u.password, '| Length:', u.password.length, '| Prefix:', u.password.slice(0, 4)));
\""
```

預期輸出：
```
Hash: $2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Length: 60
Prefix: $2b$
```

**關鍵驗證**：
- ✅ 以 `$2a$` / `$2b$` / `$2y$` 開頭
- ✅ 長度恰好 60 字元
- ✅ 明文 `Str0ngPassword!` **不** 出現於資料庫

---

## 6. 驗收 US-5 / FR-020a~c：密碼變更 + 全會話失效

### 6.1 於「裝置 A」（cookies.txt）變更密碼

```bash
# 先登入第二個裝置 B（cookies2.txt）
curl -c cookies2.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"alice@example.com","password":"Str0ngPassword!"}'

# 兩裝置都能存取 /users/me
curl -b cookies.txt  http://localhost:4000/api/users/me && echo " [device A] OK"
curl -b cookies2.txt http://localhost:4000/api/users/me && echo " [device B] OK"

# 於裝置 A 變更密碼
curl -i -b cookies.txt -X POST http://localhost:4000/api/users/me/change-password \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "oldPassword": "Str0ngPassword!",
    "newPassword": "NewStr0ngPass!!"
  }'
```

預期：
```
HTTP/1.1 200 OK
Set-Cookie: token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0
Content-Type: application/json

{"message":"密碼已更新，請重新登入"}
```

### 6.2 驗證全裝置失效

```bash
# 裝置 A 的 cookie 已被清除
curl -i -b cookies.txt http://localhost:4000/api/users/me
# 預期 HTTP 401

# 裝置 B 的 cookie 雖然還在，但 passwordChangedAt 已前進，JWT iat < passwordChangedAt
curl -i -b cookies2.txt http://localhost:4000/api/users/me
# 預期 HTTP 401，訊息: 憑證已失效，請重新登入
```

**關鍵驗證**：
- ✅ 裝置 A 的新 cookie 立即被清除
- ✅ 裝置 B 的既有 cookie 於下次請求被 `passwordChangedAt` 中介層判為失效
- ✅ 以新密碼可重新登入（`NewStr0ngPass!!`）
- ✅ 以舊密碼登入回 401

---

## 7. 驗收 FR-004b：弱密碼清單拒絕

```bash
curl -i -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "weak@example.com",
    "password": "password123",
    "displayName": "Weak"
  }'
```

預期：
```
HTTP/1.1 400 Bad Request

{"message":"輸入驗證失敗","errors":[{"path":"password","message":"此密碼過於常見，請改用較不易被猜中的密碼"}]}
```

---

## 8. 驗收 FR-011a：帳號被停用時拒絕登入

```bash
# 需具備 ADMIN 角色；以資料庫直接操作作為模擬（管理員模組的 PATCH 端點屬另一模組範圍）
docker compose exec backend sh -c "node -e \"
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.update({ where: { email: 'alice@example.com' }, data: { isActive: false } })
    .then(() => console.log('已停用 alice'));
\""

# 嘗試以新密碼登入
curl -i -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"alice@example.com","password":"NewStr0ngPass!!"}'
```

預期：
```
HTTP/1.1 403 Forbidden

{"message":"帳號已被停用"}
```

LoginLog 新增一筆 `reason: "account_disabled"`。

---

## 9. 驗收 SC-010 / FR-028a：90 天保留期清除任務

由於等待 24 小時不實際，以下為人工觸發驗證：

```bash
# 人工插入 100 筆 91 天前的紀錄
docker compose exec backend sh -c "node -e \"
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  const oldDate = new Date(Date.now() - 91 * 86400 * 1000);
  Promise.all(
    Array.from({ length: 100 }).map((_, i) =>
      p.loginLog.create({ data: { email: 'old'+i+'@x.com', ip: '1.1.1.1', success: false, reason: 'wrong_password', createdAt: oldDate } })
    )
  ).then(() => console.log('inserted 100'));
\""

# 人工觸發清除（本模組需提供一個 npm script 或管理員端點以觸發 — 見 tasks.md）
docker compose exec backend npm run scheduler:loginlog-cleanup:now

# 驗證
docker compose exec backend sh -c "node -e \"
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  const cutoff = new Date(Date.now() - 90 * 86400 * 1000);
  p.loginLog.count({ where: { createdAt: { lt: cutoff } } }).then(c => console.log('殘留:', c));
\""
```

預期：`殘留: 0`；winston 有 `event: \"loginlog_cleanup_completed\", deletedCount: 100`。

---

## 10. 驗收 FR-028d / FR-028e：LoginLog 寫入失敗時 fail-open

模擬 SQLite 寫入失敗需額外工具（如臨時 drop LoginLog 表再嘗試登入）；此項於 integration test 中以 mock 驗證，不於此 quickstart 列出互動步驟。參見 tasks.md 的 `T-103 integration-test: loginlog-fail-open`.

---

## 11. 清理

```bash
docker compose down -v   # -v 連帶清除 SQLite 與上傳檔 volume（注意會刪除所有測試資料）
```

---

## 12. SC 對照總表

| Success Criteria | 驗證方式 | 本檔章節 |
|------------------|----------|----------|
| SC-001 | 註冊+登入+訪問 /me 計時 < 2 min | §2 |
| SC-003 | 第 6 次登入回 429 | §3 |
| SC-004 | LoginLog 7 筆全欄位完整 | §4 |
| SC-005 | 資料庫 `password` 欄位符合 bcrypt 格式 | §5 |
| SC-006 | 時序一致性統計檢定（需壓測工具 + 統計分析） | — |
| SC-007 | 啟動 log 含 JWT_SECRET warn 字串（未設定時） | 可於未設 `JWT_SECRET` 時 `docker compose logs backend` 檢視 |
| SC-008 | 登出後 cookie 被清除、/me 回 401 | 延伸自 §6 |
| SC-009 | OpenAPI lint + contract test（CI 執行） | — |
| SC-010 | 清除任務於 91 天資料上執行後殘留 0 | §9 |

SC-006 需統計分析（Mann-Whitney U 檢定）；SC-009 需 CI 整合 — 這些於 tasks.md 中展開為獨立 contract / statistical test task。
