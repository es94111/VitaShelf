# 規格分析報告：認證模組（Auth Module）

**Branch**: `001-auth-module` | **Date**: 2026-04-23 | **Scope**: 01 (首次執行)
**Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) v1.1.0
**Analyzed Artifacts**:

- [spec.md](./spec.md) — 341 行、50 條 FR、10 條 SC、6 則 User Story
- [plan.md](./plan.md) — 208 行
- [research.md](./research.md) — 287 行、9 項工程決策
- [data-model.md](./data-model.md) — 286 行
- [contracts/auth.openapi.yaml](./contracts/auth.openapi.yaml) — 506 行（OpenAPI 3.2.0）
- [quickstart.md](./quickstart.md) — 368 行
- [tasks.md](./tasks.md) — 376 行、71 任務

**Operating Constraint**：此為 **READ-ONLY** 分析；本檔僅記錄發現項目與建議，不修改 spec / plan / tasks 檔。

---

## 1. Findings Table

共發現 **10 項**（CRITICAL 0 / HIGH 0 / MEDIUM 4 / LOW 5 / Resolved 1）。

> **更新紀錄 2026-04-23**：
> - 原 H-001（SC-002 效能指標缺任務）已依使用者決議移除 — SC-002 自 spec.md 移除、quickstart / plan / research 同步清理；本模組不再承諾登入 p95 ≤ 500 ms 的量化效能目標。
> - **H-002 已解決**：使用者指示「補 T073」，已於 tasks.md Phase N Polish 新增對應任務；SC-007 覆蓋率由 ❌ 轉 ✅。

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| ~~**H-002**~~ | Coverage Gap | ✅ **RESOLVED** | spec.md SC-007 / FR-010；tasks.md T073 | ~~**SC-007（JWT_SECRET 未設定時自動生成隨機值並於 log 警示）無驗證任務**~~ | ✅ 已於 tasks.md Phase N 新增 T073：`backend/tests/integration/jwt-secret-warn.test.ts`，以 `child_process.spawn` 啟動並斷言 `WARNING: JWT_SECRET not set` 字串 + token 可正常簽發 |
| **M-001** | Underspecification | MEDIUM | spec.md FR-028；tasks.md（無明確任務） | **FR-028（log 不得輸出明文密碼）無斷言任務**。雖然 T059（fail-open 測試）涵蓋一般情境，但未明確驗證「錯誤情境的 log 輸出不包含 password 欄位值」。 | 於 T059 或新增任務 `T-log-hygiene` 斷言：觸發失敗登入後，以 spy 攔截 winston transport；確認輸出 JSON **不** 包含 password / hash 的明文或前 4 字元。 |
| **M-002** | Dependency Drift | MEDIUM | tasks.md T031 提到 `React Hook Form + zod`；plan.md Primary Dependencies 未列 | **plan.md 的 Primary Dependencies 未提及 `react-hook-form` 與 `zod`**，但 T031 / T037 / T054 皆使用。這兩個套件是否已列於 `frontend/package.json` 未在 Phase 1 Setup 任務中確認。 | 於 T003 明確列出 `react-hook-form` + `zod` 的版本鎖定；若未安裝則以 `cd frontend && npm install react-hook-form zod` 補齊。或於 plan.md Technical Context 的 Primary Dependencies 加入此兩套件。 |
| **M-003** | Inconsistency | MEDIUM | tasks.md T036（「dummy verifyPassword 比對固定 hash」）；spec.md SC-006；research.md R-006 | **時序一致性實作細節未於 data-model.md 或 research.md 記錄 dummy hash 的產生方式**。T036 描述「固定 hash」但未指出此 hash 的來源（應於應用啟動時以固定 password 計算一次並 cache）。 | 在 research.md 新增 R-010「Timing-safe login」決議：dummy hash 於 `backend/src/utils/password.ts` 模組載入時以 `await bcrypt.hash('dummy-password-for-timing', 12)` 計算並 cache；T036 明確引用此常數。 |
| **M-004** | Constraint Coverage | MEDIUM | spec.md FR-028f（監控告警「SHOULD」）；tasks.md 無對應 | **FR-028f 建議監控系統以 `event: "loginlog_write_failed"` 作為告警訊號**，但 tasks.md 未新增 alerting / monitoring 相關任務。 | 於 Phase N Polish 新增任務 `T-monitoring [P] 於 docs/operations.md（新建）記錄「loginlog_write_failed 事件的 alert 建議設定」；同時於 SRS.md 的 NFR §4.3 補註此事件作為營運觀測點`。若目前專案未有 alerting 基礎建設，本任務可留作文件化。 |
| **L-001** | Cosmetic | LOW | tasks.md（編號 T009 缺失） | **任務編號 T008 → T010 跳過 T009**，無對應任務。不影響功能，僅為連號上的 cosmetic 瑕疵。 | 將 Phase 2 起始任務重編為 T009，或保留並於 tasks.md 開頭註明「T009 intentionally skipped」。 |
| **L-002** | Version Pinning | LOW | plan.md `openapi: 3.2.0`；constitution.md v1.1.0 Principle II 要求 `3.2.x` | **OpenAPI 檔案固定為 `3.2.0`**；constitution 允許 `3.2.x` 範圍。目前 3.2 僅釋出 3.2.0，技術上一致；未來若升至 3.2.1 時需同步修正。 | 無需立即調整；於 CI 新增檢查 `openapi: ^3\.2\.` regex 以允許 minor 升級。 |
| **L-003** | Semantic Redundancy | LOW | spec.md FR-020a（「`$transaction` 同時更新 password 與 passwordChangedAt」）；research.md R-004 | **單一 UPDATE 語句於 SQLite 本身即為原子**；FR-020a 的 `prisma.$transaction` 包裝屬於冗餘（即使只有一次 write）。是否保留為「intent 明示」還是「簡化為單一 update」需擇一。 | 保留 `$transaction` 以明示原子性意圖（FR-020a 意圖明確於 spec 層），或於 research.md 新增備註說明選擇。目前解讀無害。 |
| **L-004** | Terminology Drift | LOW | spec.md Edge Cases 與 quickstart.md §8；data-model.md §4.1 | **「帳號停用 → 既有 cookie 繼續有效」情境於三處描述**（spec Edge Case、data-model §4.1 狀態轉換的實作註記、quickstart §8）。三處語意一致但措辭略異。 | 統一引用 spec FR-011a 作為 canonical 來源；其他處使用「見 FR-011a」而非重複描述細節。 |
| **L-005** | Coverage Gap | LOW | spec.md FR-023b（CORS `Access-Control-Expose-Headers` 含 `Retry-After`）；tasks.md T021 | **T021 列出 CORS 設定 `exposedHeaders: ['Retry-After']`**，但未對應測試任務驗證實際 response header 於 CORS preflight 後 JS 可讀。T056 契約測試可能涵蓋，但非直接針對 CORS expose 行為。 | 於 T056 補一條斷言：fetch 模擬 cross-origin 請求並讀 `response.headers.get('Retry-After')` 非 null。低影響，可於 contract test 內完成。 |

---

## 2. Coverage Summary Table

> 僅列出 **可建置功能**（buildable work）對應的 Functional Requirements / Success Criteria；constraint-style 陳述（如 FR-011b「不得實作自動鎖定」、FR-013a「不設併發上限」）不列入 task coverage（以「不實作」方式滿足）。

### 2.1 Functional Requirements Coverage

| Requirement | Has Task? | Task IDs | Notes |
|-------------|-----------|----------|-------|
| FR-001（register core） | ✅ | T028, T029, T030, T031, T032 | 完整覆蓋 |
| FR-002（email format） | ✅ | T030 validator, T029 | |
| FR-003（email unique） | ✅ | T030, T029 scenario 3 | |
| FR-003a（trim + lowercase only） | ✅ | T030, T029 | |
| FR-004（≥ 8 chars） | ✅ | T030, T029 scenario 4 | |
| FR-004a（no char classes required） | ✅ | T030（驗證器未加 class 要求即滿足） | 負面規範 |
| FR-004b（top-10k weak list） | ✅ | T007, T014, T015, T029 scenario 5 | |
| FR-004c（no DB write on fail） | ✅ | T029 斷言 + T030 validator-first | |
| FR-005（displayName trim） | ✅ | T030, T029 | |
| FR-006（bcrypt cost ≥ 12） | ✅ | T014, T015, T061 | |
| FR-007（registrationOpen gate） | ✅ | T030, T029 scenario 2 | |
| FR-008（login + cookie） | ✅ | T033, T034, T036 | |
| FR-009（JWT 7d） | ✅ | T016, T017 | |
| FR-010（JWT_SECRET env） | ✅ | 既有 `utils/jwtSecret.ts` + T073 | H-002 已解決 |
| FR-011（unified 401） | ✅ | T036, T034 scenario 3 | |
| FR-011a（isActive check） | ✅ | T036, T034 | |
| FR-011b（no auto-lock） | N/A | 負面規範 | 以「不實作」滿足 |
| FR-012（cookie-only source） | ✅ | T018 | |
| FR-012a（CSRF） | ✅ | T019, T021 | |
| FR-012b（passwordChangedAt check） | ✅ | T018 | |
| FR-013（logout endpoint） | ✅ | T039, T040, T041 | |
| FR-013a（no concurrent limit） | N/A | 負面規範 | 以「不實作」滿足 |
| FR-014（frontend logout） | ✅ | T042, T043 | |
| FR-015（GET /me whitelist） | ✅ | T044, T046 | |
| FR-016（PUT /me whitelist） | ✅ | T044, T045, T047 | |
| FR-017（theme enum） | ✅ | T047 validator, T045 | |
| FR-018 ~ FR-020（change password） | ✅ | T050, T051, T053 | |
| FR-020a（atomic）| ✅ | T052, T053 | L-003 標註冗餘 |
| FR-020b（clear cookie on change） | ✅ | T050, T053 | |
| FR-020c（cross-device expire） | ✅ | T051 | |
| FR-021 / FR-022 / FR-023（rate limit） | ✅ | T020, T036, T057 | |
| FR-023a（Retry-After + body） | ✅ | T020, T056, T057 | |
| FR-023b（CORS expose） | ⚠️ 部分 | T021 設定 | **L-005** 缺 CORS-expose 斷言 |
| FR-023c（no bcrypt on rate-limit） | ✅ | T057 驗證回應時間 | |
| FR-024 / FR-025（LoginLog on fail/success） | ✅ | T030, T036, T058 | |
| FR-026（ip/country/method non-null） | ✅ | T058 | |
| FR-027（reason enum） | ✅ | T036, T058 | |
| FR-028（no password in log） | ⚠️ 部分 | 隱含於 T022 | **M-001** 缺明確斷言 |
| FR-028a / FR-028b（cron cleanup） | ✅ | T023, T024, T060 | |
| FR-028c（env override optional） | N/A | 「MAY」非 MUST | 未列為任務合理 |
| FR-028d / FR-028e（fail-open + log） | ✅ | T022, T059 | |
| FR-028f（monitoring signal） | ⚠️ 部分 | 無 alerting 任務 | **M-004** |
| FR-029（OpenAPI 3.2 contracts） | ✅ | T005 lint, 所有 contract tests | |

### 2.2 Success Criteria Coverage

| SC | Has Task? | Task IDs | Notes |
|----|-----------|----------|-------|
| SC-001（2 min user journey） | ✅ | T029 + manual quickstart §2 | |
| SC-003（6th login blocked） | ✅ | T057 | |
| SC-004（LoginLog 100% coverage） | ✅ | T058 | |
| SC-005（bcrypt format） | ✅ | T061 | |
| SC-006（timing equality） | ✅ | T035 | M-003 補充 dummy hash 來源 |
| SC-007（JWT_SECRET warn） | ✅ | T073 | H-002 已解決（2026-04-23） |
| SC-008（logout cookie clear） | ✅ | T040 | |
| SC-009（OpenAPI contract） | ✅ | T005 + 所有 contract tests | |
| SC-010（90-day cleanup） | ✅ | T060 | |

**Functional Requirements Coverage**：43 / 45 buildable FRs = **95.6%**（2 項 ⚠️ 部分；2 項 N/A 為負面規範；FR-010 於 T073 加入後升級為 ✅）
**Success Criteria Coverage**：9 / 9 = **100%**（所有剩餘 SC 皆有任務覆蓋；SC-002 已移除、SC-007 由 T073 覆蓋）

---

## 3. Constitution Alignment

依 [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) v1.1.0 五項原則逐一核對：

| Principle | Status | 依據 |
|-----------|--------|------|
| **I. Traditional Chinese Documentation** | ✅ | spec / plan / tasks / research / data-model / quickstart / analyze-01 皆為 zh-TW；OpenAPI `description` 欄位為 zh-TW；constitution 本身為 English 屬例外（governance 明示） |
| **II. OpenAPI 3.2 Contract-First** | ✅ | `contracts/auth.openapi.yaml` 的 `openapi:` 欄位 = `3.2.0`；所有 6 endpoint 皆於 spec 定義；tasks.md 所有 endpoint 實作任務（T030/T036/T041/T046/T047/T053）之前皆有對應 contract test 任務（T028/T033/T039/T044/T050） |
| **III. TypeScript Strict** | ✅ | plan.md Technical Context 明訂 TypeScript 5.9 + strict；T004 openapi-typescript 產生前端型別；T071 `npm run typecheck` 為合併閘門 |
| **IV. Secure by Default** | ✅ | T020 inline `router.use(loginRateLimit)`；T019 CSRF middleware；T014 bcrypt + pre-hash；existing `utils/jwtSecret.ts`（fail-open warn）；T065 CodeQL scan |
| **V. Reproducible Containerised Deployment** | ✅ | T012 Prisma migration 透過 `docker-entrypoint.sh` 於容器啟動時執行；T024 node-cron 排程於 `backend/src/index.ts` 啟動時掛載（與容器同生同死，不依賴外部 cron）；單一 image（無新服務） |

**結論**：**0 項違規**。所有原則皆滿足。

---

## 4. Unmapped Tasks

> 「非對應任何 FR / SC 的任務」應為 setup / polish / 跨切面關注 — 若有「無明確上位需求的實作任務」則是可疑。

| Task ID | Description | Why Unmapped? | 合理性判斷 |
|---------|-------------|---------------|------------|
| T001 ~ T008 | Setup phase | 屬共用基礎建設（ tool chain、typegen、lint 配置） | ✅ 合理 |
| T010 ~ T027 | Foundational phase | 屬跨 Story 共用元件 | ✅ 合理 |
| T064 ~ T072 | Polish phase | CodeQL、文件、quickstart、lint、typecheck 交付閘門 | ✅ 合理 |

所有任務皆能對應至 **Setup / Foundational / 特定 Story / Polish**，無孤兒任務。

---

## 5. Duplication & Ambiguity Detection

### 5.1 Duplication

掃描 FR / SC / User Story / Task 描述，**無** 發現語意重複。FR-004 / FR-004a-c 及 FR-021 / FR-022 / FR-023 / FR-023a-c 雖共享主題，但每條規範獨立子面向，非重複。

### 5.2 Ambiguity

無未解的 `NEEDS CLARIFICATION`、`TODO`、`???`、`TBD` 標記（已於第二輪 `/speckit.clarify` 用盡 9 則高影響問題；第三輪回報 `No critical ambiguities`）。

### 5.3 Vague Adjectives

spec 中使用的「合理」「高強度」「可重現」皆有量化定義（如 "128 字元亂數"、"時鐘偏差 ± 60 秒"、"90 天"），無遺留 vague 用詞。

---

## 6. Metrics

| 指標 | 數值 |
|------|------|
| Total Functional Requirements | 50（含子 FR） |
| Total Success Criteria | 9（SC-002 已移除） |
| Total Tasks | 72（T001–T073，T009 缺號） |
| Task / FR 覆蓋率 | 95.6% buildable |
| Task / SC 覆蓋率 | 100% |
| CRITICAL issues | 0 |
| HIGH issues | 0（H-002 已於 T073 解決） |
| MEDIUM issues | 4 |
| LOW issues | 5 |
| 並行任務（[P]）比例 | 54 / 71 = 76% |
| Constitution 違規項目 | 0 |

---

## 7. Next Actions

由於 **0 CRITICAL 違規、0 HIGH 缺口**（H-002 已由 T073 補上），可直接進入 `/speckit.implement`。

### 必要行動

✅ 全部完成。

### 建議行動（可於 implement 中或 polish 階段處理）

3. **M-001** 於 T059 擴充 log 明文密碼斷言（< 5 行程式碼）
4. **M-002** 於 T003 補 `react-hook-form` + `zod` 版本鎖定；或於 plan.md 補列
5. **M-003** 於 research.md 新增 R-010 記錄 dummy-hash 策略
6. **M-004** 於 Phase N 新增 `docs/operations.md` 記錄 `loginlog_write_failed` 告警建議

### 低優先（L-001 ~ L-005）

- 可於 implement 階段順手處理，不阻擋 MVP

### 建議執行順序

```
1. （手動）編輯 tasks.md 新增 T073 / T074
2. /speckit.implement     # 正式進入實作（依 MVP 路徑：Phase 1 → 2 → 3 → 4 → 5 → STOP 驗收）
3. 於 implement 過程自然處理 M-001 ~ M-004 / L-001 ~ L-005
```

---

## 8. Remediation Offer

是否需要我（剩餘 MEDIUM / LOW 為可選補正）：

1. ~~**自動產生** H-002 的具體任務條目~~ → ✅ 已於 2026-04-23 完成（T073 已加入 tasks.md Phase N）
2. **自動補正** M-002（於 T003 明確列出 `react-hook-form` + `zod` 版本，或於 plan.md Primary Dependencies 追加）
3. **自動新增** research.md R-010 記錄 dummy-hash 策略（M-003）
4. **自動統一** L-004（將「帳號停用 → 既有 cookie」描述統一引用 FR-011a）

以上 2~4 皆需使用者明確同意；本分析階段（`/speckit.analyze`）本身為 read-only，不會擅自修改檔案。
若同意任一補正，請回覆對應編號；若要直接進入實作，可以 `/speckit.implement` 繼續（**建議路徑**，因 HIGH 缺口已全部補齊）。
