<!--
Sync Impact Report
==================
Version change: (uninitialized template) → 1.0.0  (initial ratification)
Modified principles: N/A — initial definition of Principles I–V
Added sections:
  - Core Principles (I. 繁體中文文件 / II. OpenAPI 3.2 合約優先 / III. TypeScript 全棧嚴格模式 / IV. 安全預設 / V. 容器化可重現部署)
  - Technical Constraints
  - Development Workflow
  - Governance
Removed sections: none
Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check 區塊替換為具體閘門
  ✅ .specify/templates/spec-template.md — 已審閱，結構未受影響（語言要求由原則 I 於輸出時執行）
  ✅ .specify/templates/tasks-template.md — 已審閱，既有 contract / test 分類已符合原則 II
  ✅ .specify/templates/checklist-template.md — 已審閱，結構未受影響
  ✅ .github/prompts/speckit.*.prompt.md — 無 agent-specific (CLAUDE-only) 引用需改
  ✅ .specify/templates/commands/ — 目錄不存在，無需更新
Follow-up TODOs: 無
-->

# VitaShelf Constitution

## Core Principles

### I. 繁體中文文件 (NON-NEGOTIABLE)

所有 specification、implementation plan、tasks、checklist、quickstart、research、changelog、使用者介面文案、`README.md`、`SRS.md`、API 說明與其他任何會被使用者（含外部開發者）閱讀的文件 **MUST** 以繁體中文（zh-TW）撰寫。程式碼識別子、型別定義、測試名稱與 commit title 不在此限；PR 標題與描述 SHOULD 使用繁體中文。翻譯為其他語言的版本屬額外產出，不得取代繁體中文主文件。

Rationale: 主要使用者群為繁體中文市場；雙語或英文主文件會造成翻譯漂移與維護負擔。

### II. OpenAPI 3.2 合約優先 (NON-NEGOTIABLE)

所有 HTTP/REST 介面 **MUST** 先以 **OpenAPI 3.2** 規格定義，再進行實作。規格檔案 **MUST** 位於功能目錄下的 `specs/[###-feature]/contracts/` 或專案統一的 `openapi/` 目錄。任何 endpoint 的新增、路徑或簽章變更、status code、schema 欄位調整都 **MUST** 先更新 OpenAPI 規格，並與實作於同一 PR 提交。不得在沒有對應 OpenAPI 條目的情況下合併 endpoint 實作；不得使用低於 3.2 的版本。

Rationale: 單一事實合約可驗證前後端、產生 client / server stubs、並於外部整合時減少溝通成本。3.2 帶來 webhooks、discriminator 強化與更精確的 schema 組合能力。

### III. TypeScript 全棧嚴格模式

前端與後端 **MUST** 以 TypeScript 撰寫，`tsconfig` **MUST** 啟用 `strict: true`（含 `noImplicitAny`、`strictNullChecks`）並建議啟用 `noUncheckedIndexedAccess`。`any` 的使用必須有明確註釋說明理由。Public API 邊界（HTTP、Prisma、跨模組函式簽章）**MUST** 以由 OpenAPI、Prisma 或 zod 產生 / 驗證的型別雙向約束，不得以手刻 interface 單邊宣告取代。

Rationale: 全棧共用語言降低邊界錯誤；strict 模式在編譯期攔截 null/undefined 類的執行期崩潰。

### IV. 安全預設 (Secure by Default)

涉及 secret、驗證、授權、速率限制、外部輸入的程式碼 **MUST** 遵守：

- Secrets 不得寫死於原始碼或 committed 檔案；生產環境缺少 `JWT_SECRET` 等關鍵變數時 **MUST** 拒絕啟動。
- 所有 Express router **MUST** 套用 `rateLimit` middleware（可直接於路由檔 inline 宣告），以滿足 CodeQL `js/missing-rate-limiting` 規則。
- 所有外部輸入（query、body、檔案、CSV）**MUST** 驗證結構、型別與大小上限（例如 CSV parser 的 loop bound）。
- CodeQL、dependency audit、secret-scan 的 high / critical 警告 **MUST** 在合併前解決，或以風險說明明確豁免。
- 敏感欄位 SHOULD 利用 `DB_ENCRYPTION_KEY` 啟用應用層加密。

Rationale: 近期 PR #16–#19 即為補上 rate limiting 與 CSV DoS 上限；本原則將臨時補救固化為預設閘門，防止同類問題再次入庫。

### V. 容器化可重現部署

所有環境（本機開發、CI、生產）**MUST** 透過 `docker compose` + 對應的 compose 檔啟動；專案維持單一 image（Nginx + Node.js）並由 `docker-entrypoint.sh` 負責 migration。重大基礎設施變更 **MUST** 同步更新 compose 檔、`docker-entrypoint.sh`、`.env.example`、`nginx.conf` 與 `README.md` 中的啟動指引。不得引入必須在容器外手動執行的必要步驟。

Rationale: 單一 image + compose 是現況部署模式；分裂 image 或外部化 migration 會讓「GitHub Actions → Docker Hub/GHCR → 生產」的鏈條失去單一事實部署流程。

## Technical Constraints

- **執行環境**：Node.js ≥ 20；前端使用 Vite 6 build；Nginx 作為反向代理。
- **資料存取**：Prisma ORM；目前資料庫為 SQLite（commit 651c456），PostgreSQL 保留為生產可選。schema 變更 **MUST** 產生 migration 並納入 `docker-entrypoint.sh` 啟動序列。
- **API 規格工具鏈**：OpenAPI **3.2**。推薦驗證工具為 `@redocly/cli` 或 `swagger-cli`；型別產生使用 `openapi-typescript` 或同等工具。規格 lint 納入 CI。
- **前端技術**：React 19 + React Router 7 + Tailwind CSS 4 + Recharts 3；PWA manifest 必要時同步更新。
- **稽核與觀測**：登入事件 **MUST** 寫入稽核表；前端錯誤 **MUST** 經 React Error Boundary 攔截；後端錯誤 **MUST** 以結構化格式記錄。
- **版本**：應用程式版本記錄於 `VERSION` 與 `changelog.json`；本憲法版本獨立於應用程式版本。

## Development Workflow

1. **Spec-Driven**：新功能依序通過 `/speckit.specify` → `/speckit.clarify`（必要時）→ `/speckit.plan` → `/speckit.tasks` →（選用 `/speckit.analyze` / `/speckit.checklist`）→ `/speckit.implement`。
2. **分支命名**：功能分支使用 `###-feature-name` 格式（由 `/speckit.specify` 建立）。
3. **PR 合併閘門**（MUST 全部通過才可合併）：
   - CI（lint、typecheck、build、test）綠燈。
   - CodeQL 無 high / critical 警告（或附明確豁免說明）。
   - OpenAPI 規格 lint 通過。
   - 涉及新 endpoint 時，OpenAPI 文件、contract test、實作三者 **MUST** 同一 PR 內同步提交。
   - 所有新 / 修改之使用者可見文件為繁體中文。
4. **Commit / PR 訊息**：Commit title 使用 Conventional Commits（`feat:`、`fix:`、`docs:` 等），主體使用繁體中文說明變更理由。
5. **文件同步**：任何改變使用者可見行為的變更 **MUST** 同步更新 `README.md`、`SRS.md`、`changelog.json`，並依語意化版本升級應用程式版本號。

## Governance

本憲法凌駕於其他開發慣例與文件；任何模板（plan、spec、tasks、checklist）或 agent prompt 與本憲法牴觸時，以憲法為準，並於下次 amendment 時同步修正該模板。

**修訂程序**：憲法修訂 PR **MUST** 包含 (a) 修改原因、(b) 版本升級類型與理由、(c) 下游模板 / prompt 的同步更新、(d) 更新 Sync Impact Report 區塊。

**版本升級規則**（語意化版本）：

- **MAJOR**：移除或以不相容方式重新定義既有原則；變更治理核心（例如廢除非可妥協標記）。
- **MINOR**：新增原則、新增章節，或對既有原則做實質擴充。
- **PATCH**：用字釐清、錯字修正、非語意調整。

**合規審查**：PR reviewer **MUST** 判斷變更是否影響憲法原則；若影響且未同步憲法，PR 視為 blocked。

**runtime 指引**：日常開發細節（工具使用、腳本、環境變數）以 `README.md`、`SRS.md`、`CLAUDE.md` 為主；本憲法僅定義不可妥協的原則與閘門。

**Version**: 1.0.0 | **Ratified**: 2026-04-23 | **Last Amended**: 2026-04-23
