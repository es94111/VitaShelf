# Prisma 6 → 7 升級計畫

**目前版本**：`@prisma/client` `^6.19.3` / `prisma` `^6.19.3`
**目標版本**：`7.x`（最新 stable）
**範圍**：`backend/`（SQLite + Express + TypeScript CommonJS）

---

## 一、現況勘查

### Prisma 使用點

| 檔案 | 用途 |
|---|---|
| `backend/prisma/schema.prisma` | Schema（generator + sqlite datasource） |
| `backend/prisma/seed.ts` | Seeding（`new PrismaClient()`） |
| `backend/src/utils/prisma.ts` | Singleton 匯出 |
| `backend/src/schedulers/loginLogCleanup.ts` | `import type { PrismaClient }` |
| `backend/src/routes/*.ts`（11 檔） | 業務邏輯 |
| `backend/src/middleware/auth.ts` | 認證查詢 |
| `backend/src/utils/{stock,loginLog}.ts` | 工具函式 |

共 **16 個檔案** import `@prisma/client`。

### 環境

- `backend/tsconfig.json`：`module: "CommonJS"`、`target: "ES2020"`
- `backend/package.json`：未設 `"type": "module"`（CJS）
- Schema：`provider = "prisma-client-js"`（**舊版 generator，Prisma 7 棄用**）
- Datasource：SQLite
- `binaryTargets`：包含 alpine（musl）變體 → Docker `node:24-alpine`
- Dockerfile 流程：`npx prisma generate` → `npm run build` → `npx prisma migrate deploy`
- 部署 Docker 內複製 `node_modules/.prisma`

---

## 二、Prisma 7 Breaking Changes（與本專案相關）

| # | 變更 | 對本專案影響 |
|---|---|---|
| 1 | **最低 Node 20.19**（建議 22+） | ✅ Dockerfile 用 `node:24-alpine`，符合 |
| 2 | **ESM-only**（須 `"type": "module"`） | ⚠️ **重大**：backend 目前是 CJS，需評估 |
| 3 | Generator 改為 `prisma-client`（`prisma-client-js` 棄用） | ⚠️ 改 schema |
| 4 | Generator `output` 變**必填**（不再寫入 `node_modules`） | ⚠️ 影響所有 import 路徑 + Dockerfile |
| 5 | **Driver adapter 必填**：SQLite 需 `@prisma/adapter-better-sqlite3` | ⚠️ 改 client 初始化 |
| 6 | 新增 `prisma.config.ts`（取代部分舊設定） | 🟡 新增檔案 |
| 7 | `prisma migrate dev` 不再自動 generate | 🟡 文件/腳本調整 |
| 8 | 移除 `--skip-generate` / `--skip-seed` flags | 🟡 檢查 CI/腳本 |
| 9 | Seeding 不再自動執行，必須顯式 `npx prisma db seed` | 🟡 文件 |

---

## 三、執行階段

### Phase 0：先決條件 & 建立分支 ✅

- [x] 建立 feature branch：`chore/prisma-7-upgrade`
- [x] 開發前先在本地跑一次 `npm test` 取得 baseline 通過數
  - **Baseline (2026-04-30)**：`npm run typecheck` = **0 errors**；`npm test` = **43/43 pass**（unit + integration + contract，duration 59s）
- [ ] 備份 `prisma/data/vitashelf.db`（升級前再做即可，schema 不變動）

### Phase 1：模組系統決策（最關鍵）

Prisma 7 是 ESM-only。兩條路：

**方案 A：保留 CommonJS（影響最小）**
- TypeScript CJS 專案仍可消費 ESM 套件，只要：
  - `tsconfig`：`"module": "Node16"` 或 `"NodeNext"`、`"moduleResolution": "NodeNext"`
  - 所有 relative import 加 `.js` 副檔名（**大改動**）

**方案 B：全面遷移到 ESM（推薦）**
- `package.json` 加 `"type": "module"`
- `tsconfig`：`"module": "NodeNext"`、`"moduleResolution": "NodeNext"`
- 所有 relative import 補 `.js` 副檔名
- 改動大但符合長期方向

**建議**：方案 B。Prisma 已全面 ESM，未來其他依賴也會跟進。

### Phase 2：Schema & Generator 遷移

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"  // 必填
}
```

- [ ] 改 `schema.prisma` 的 generator 區塊
- [ ] 將 `output` 路徑加入 `.gitignore`
- [ ] 全專案搜尋取代：`from '@prisma/client'` → `from '../generated/prisma'`（16 檔）

### Phase 3：安裝新套件 & 改 Client 初始化

```bash
npm install @prisma/client@7 prisma@7
npm install @prisma/adapter-better-sqlite3 better-sqlite3
npm install -D @types/better-sqlite3
```

```ts
// backend/src/utils/prisma.ts
import { PrismaClient } from '../generated/prisma'
import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSQLite3({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
export default prisma
```

### Phase 4：新增 `prisma.config.ts`

```ts
// backend/prisma.config.ts
import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: { seed: 'tsx prisma/seed.ts' },
})
```

### Phase 5：Dockerfile 調整

- alpine 加 build deps（python3 / make / g++）給 better-sqlite3
- 不再複製 `node_modules/.prisma`，改複製 `src/generated`

### Phase 6：更新 npm scripts

```diff
- "db:migrate": "prisma migrate dev",
+ "db:migrate": "prisma migrate dev && prisma generate",
  "db:seed": "prisma db seed"
```

### Phase 7：驗證

- [ ] `npm install` / `db:generate` / `typecheck` / `db:migrate` / `db:seed` / `test` / `build` 全綠
- [ ] Docker build & run 成功
- [ ] 手動驗證關鍵流程：登入、商品 CRUD、匯出/匯入、儀表板

### Phase 8：文件 & 收尾

- [ ] 更新 README/CLAUDE.md
- [ ] PR 標註 BREAKING CHANGE

---

## 四、風險清單

| 風險 | 嚴重度 | 緩解 |
|---|---|---|
| ESM 遷移波及全 backend | 🔴 高 | codemod 或逐檔修 `.js` 副檔名 |
| better-sqlite3 alpine 編譯失敗 | 🟡 中 | Dockerfile 加 build deps |
| Driver adapter 效能差異 | 🟡 中 | benchmark 對比 |
| 16 檔 import 路徑改動回歸 | 🟡 中 | path alias + 完整 test |

---

## 五、回滾策略

- 全部變更於單一 PR（含 Dockerfile、schema、code、scripts）
- 出問題：`git revert <merge-commit>` + 重新部署舊 image
- DB schema 不變動 → 可安全回滾

---

## 六、預估工時

| Phase | 工時 |
|---|---|
| 1（ESM 遷移） | 4–6h |
| 2–4（Schema/Client/Config） | 2–3h |
| 5（Dockerfile） | 1–2h |
| 6–7（驗證） | 2–4h |
| 8（文件） | 1h |
| **合計** | **10–16h** |

---

## 七、執行順序建議

1. 先單獨完成 **Phase 1（ESM 遷移）** 並合併
2. 再執行 **Phase 2–8** 作為「Prisma 7 升級」獨立 PR
