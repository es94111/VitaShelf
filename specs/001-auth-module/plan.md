# 實作計畫書：認證模組（Auth Module）

**Branch**: `001-auth-module` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: 功能規格書 [`/specs/001-auth-module/spec.md`](./spec.md)

> **憲法對齊**：依據 [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) v1.1.0。
> 本 plan 以繁體中文（zh-TW）撰寫（Principle I）；所有 HTTP 對外介面於 `contracts/` 下以 `openapi: 3.2.x` 規格定義（Principle II）。

---

## Summary

本模組為 VitaShelf 的登入認證核心，包含：註冊、登入、登出、個人資料、密碼變更、登入稽核、IP 限流六個子流程。依循 [spec.md](./spec.md) 的 **9 項 Clarification 決議**：

1. **httpOnly cookie + SameSite=Strict** 下發 JWT（無 token 明文回應本體）
2. **`User.isActive`** 管理員停用旗標（無自動鎖定）
3. **LoginLog 90 天保留** + `node-cron` 排程清除
4. **429 `Retry-After` + `retryAfterSeconds`** 雙通道
5. **Email 正規化 = `trim + lowercase`**（不展 Gmail 別名）
6. **NIST 風格密碼政策** + top-10,000 弱密碼清單
7. **`User.passwordChangedAt`** 全會話失效機制
8. **LoginLog 寫入 fail-open** + winston 結構化 error log
9. **不設併發會話上限**

技術面採既有 VitaShelf 單一 Docker image（Nginx + Node.js + SQLite volume）架構擴充，不新增基礎設施元件；所有密碼學/安全決策皆使用 Node.js 生態成熟函式庫（`bcryptjs`、`jsonwebtoken`、`express-rate-limit`）。

---

## Technical Context

**Language/Version**：
- 前端：TypeScript 5.9 + React 19
- 後端：TypeScript 5.9 + Node.js 20

**Primary Dependencies**（鎖定於專案 `package.json`）：
- **前端**：React 19、React Router 7、TanStack Query 5、Axios、Tailwind CSS 4、Vite 6、Recharts、date-fns、clsx、tailwind-merge、lucide-react
- **後端**：Express 5、Prisma 6、bcryptjs、jsonwebtoken、express-validator、express-rate-limit、multer、node-cron、winston、tsx（dev）

**Storage**：SQLite（檔案路徑 `file:/app/data/vitashelf.db`，透過 Docker volume 持久化；憲法 Technical Constraints）

**Testing**：
- **後端**：Node.js 內建 `node:test` + `tsx` 執行；合約測試以 OpenAPI 3.2 spec 驗證（`openapi-request-validator` 或同等）
- **前端**：Vitest + React Testing Library（與既有專案一致）

**Target Platform**：Linux x86_64 / ARM64 容器（node:20-alpine base image）；瀏覽器目標為最近兩個主要版本（Chrome / Edge / Firefox / Safari）

**Project Type**：Web application（既有 monorepo：`backend/` + `frontend/`，符合 plan-template Option 2）

**Performance Goals**（參見 spec §3 SC-003）：
- 同 IP 第 6 次錯誤登入 100% 於限流窗內被擋

**Constraints**：
- 必須 fit 於既有單一 Docker image（不新增 service）
- SQLite 單寫入限制 — LoginLog 寫入需考量短交易
- JWT 簽章金鑰由 `JWT_SECRET` 環境變數注入，未設定則啟動時隨機生成並於 log 警示

**Scale/Scope**：個人/家庭/小型商家使用者（SRS §1.3），預計單一容器需承載 100~1,000 註冊使用者、登入日均 10~100 次；SQLite 於此量級下效能足夠。

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

依據 [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) v1.1.0 衍生的閘門：

- [x] **I. 繁體中文文件**：本 plan、spec、tasks、quickstart、research、contracts 的 `description` 欄位皆以繁體中文（zh-TW）撰寫（`.specify/memory/constitution.md` 本身與 OpenAPI 欄位名如 `operationId` 除外）。
- [x] **II. OpenAPI 3.2 合約優先**：本 plan 產出 [`contracts/auth.openapi.yaml`](./contracts/auth.openapi.yaml)（`openapi: 3.2.0`）；endpoint 實作 **不會** 先於規格合併（由 PR 流程把關）。
- [x] **III. TypeScript 嚴格模式**：新增 / 修改的模組保持 `strict: true`；未引入 `any` 或停用 strict 旗標。所有跨邊界型別由 `openapi-typescript`（前端）與 Prisma Client（後端）產生。
- [x] **IV. 安全預設**：
  - `/api/auth` router 使用 inline `router.use(rateLimit(...))` 通過 CodeQL `js/missing-rate-limiting`（FR-022）
  - 所有外部輸入以 `express-validator` 驗證（email 格式、密碼長度、displayName trim、theme enum）
  - `JWT_SECRET` 於生產環境未設定時拒絕啟動（或於容器 entrypoint 自動生成並 WARN）
  - CodeQL 高風險警告於 PR 合併前處理
- [x] **V. 容器化部署**：Prisma migration 透過 `docker-entrypoint.sh` 的 `prisma migrate deploy` 執行；`node-cron` 清除任務由後端常駐行程持有（不依賴容器外 cron）；`docker compose up -d` 一鍵啟動。

所有 5 項皆通過，無需 Complexity Tracking 條目。

---

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-module/
├── plan.md              # 本檔（/speckit.plan 產出）
├── spec.md              # /speckit.specify + /speckit.clarify 產出
├── research.md          # Phase 0 產出（本指令）
├── data-model.md        # Phase 1 產出（本指令）
├── quickstart.md        # Phase 1 產出（本指令）
├── contracts/
│   └── auth.openapi.yaml # Phase 1 產出（OpenAPI 3.2）
└── tasks.md             # Phase 2 產出（/speckit.tasks 指令）
```

### Source Code（repository root）

本專案為既有 monorepo，此模組對應：

```text
backend/
├── src/
│   ├── routes/
│   │   └── auth.ts                    # ★ 本模組主要實作（已存在，將擴充）
│   ├── middleware/
│   │   ├── auth.ts                    # ★ JWT cookie 驗證中介層（已存在，加 passwordChangedAt 比對）
│   │   ├── csrf.ts                    # ★ 新增 CSRF 中介層（依 research.md 決定方案）
│   │   └── rateLimit.ts               # ★ 限流配置（已存在，強化 429 Retry-After 回應）
│   ├── utils/
│   │   ├── password.ts                # ★ 新增：bcrypt wrapper + 弱密碼清單 + pre-hash
│   │   ├── weakPasswords.ts           # ★ 新增：嵌入 top-10k 清單（靜態資料）
│   │   ├── jwt.ts                     # ★ 新增：簽章/驗證/cookie 設定的 single source
│   │   ├── jwtSecret.ts               # 既有：JWT_SECRET 管理
│   │   └── ipCountry.ts               # 既有：IP → 國碼
│   ├── schedulers/
│   │   └── loginLogCleanup.ts         # ★ 新增：node-cron 90 天清除任務
│   └── index.ts                       # 既有：啟動 + 掛載 scheduler
└── prisma/
    ├── schema.prisma                  # ★ User 加 isActive / passwordChangedAt
    └── migrations/
        └── YYYYMMDDHHMMSS_auth_module/
            └── migration.sql          # ★ ALTER TABLE User

frontend/
├── src/
│   ├── pages/
│   │   ├── Login.tsx                  # ★ 改為不處理 token（cookie 自動）+ 429 倒數
│   │   ├── Register.tsx               # ★ 加弱密碼提示
│   │   └── Settings.tsx               # ★ 密碼變更後導回登入頁
│   ├── services/
│   │   ├── api.ts                     # ★ Axios withCredentials=true + 401 攔截
│   │   └── auth.ts                    # ★ login / register / logout / changePassword 封裝
│   └── hooks/
│       └── useAuth.ts                 # ★ 整合 TanStack Query + cookie-session 偵測
```

**Structure Decision**：既有 Web application monorepo（`backend/` + `frontend/`）；本模組不新增頂層目錄，僅於既有 `routes/`、`middleware/`、`utils/` 下擴充檔案。

---

## Phase 0 Output

請見 [`research.md`](./research.md) — 解決 spec Clarification 階段標記的 Deferred 工程決策：

1. CSRF 方案選型
2. 弱密碼清單來源
3. `node-cron` 排程時間
4. `passwordChangedAt` 中介層快取策略
5. JWT 簽章演算法
6. bcrypt 72-byte 上限處理
7. `express-rate-limit` 計數儲存

所有 `NEEDS CLARIFICATION` 已於 Phase 0 解決，Technical Context 無殘留未決項目。

---

## Phase 1 Output

### 資料模型

請見 [`data-model.md`](./data-model.md) — 包含 `User` / `LoginLog` 的 Prisma schema 異動、SQLite migration SQL、欄位驗證規則、狀態轉換圖。

### API 合約

請見 [`contracts/auth.openapi.yaml`](./contracts/auth.openapi.yaml) — OpenAPI **3.2.0** 規格，涵蓋：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/users/me`
- `PUT  /api/users/me`
- `POST /api/users/me/change-password`

含：cookie auth scheme、CSRF token scheme、429 的 `Retry-After` header 定義、`retryAfterSeconds` body 欄位、所有錯誤 schema。

### 快速驗收腳本

請見 [`quickstart.md`](./quickstart.md) — 本地一鍵驗收指令（`docker compose up` + curl 範本 + 預期輸出），對應 spec §3 的 10 項 SC。

### Agent Context

本專案以 `CLAUDE.md` 作為 agent 上下文（而非 `.github/copilot-instructions.md`）；plan 指令不修改 `CLAUDE.md`，因其內容屬 skill routing 範疇。相關的 plan 連結於 PR 描述與 task 指派時引用即可。

---

## Post-Design Constitution Re-Check

於 Phase 1 完成後重新檢視：

- [x] **I. 繁體中文文件**：所有產出檔案以 zh-TW 撰寫；OpenAPI `description` 欄位亦為 zh-TW；schema 欄位名（如 `email`、`displayName`）維持英文為程式識別子。
- [x] **II. OpenAPI 3.2**：`contracts/auth.openapi.yaml` 的 `openapi:` 欄位為 `3.2.0`；所有 6 個 endpoint 皆定義完整 request/response schema；`Retry-After` / CSRF cookie 均有明確宣告。
- [x] **III. TypeScript 嚴格模式**：前端由 `openapi-typescript` 產生 `AuthApi` 型別；後端 router 以 Prisma Client 型別為基礎；未引入 `any`。
- [x] **IV. 安全預設**：`passwordChangedAt` 機制使 JWT 可被使用者主動吊銷而不需黑名單；CSRF 方案（research.md 決定採 `SameSite=Strict` + Origin 檢查）足以防護狀態改變端點；限流 inline 宣告於 `auth.ts` 路由檔。
- [x] **V. 容器化**：`schedulers/loginLogCleanup.ts` 於 `backend/src/index.ts` 啟動時掛載；與容器同生同死；`docker-entrypoint.sh` 無需調整。

**結論**：Phase 1 無引入新違規；可進入 `/speckit.tasks`。

---

## Complexity Tracking

無。所有 5 項憲法閘門通過，未新增需要說明的複雜度。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| （無） | — | — |
