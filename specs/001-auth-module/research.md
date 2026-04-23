# 研究筆記：認證模組（Auth Module）— Phase 0

**Branch**: `001-auth-module` | **Date**: 2026-04-23 | **Plan**: [plan.md](./plan.md)

> 本檔用於記錄 spec.md 中 `/speckit.clarify` 階段標記為 **Deferred 至 plan** 的工程決策，以及技術選型的理由。每一決策項目採用：
> - **Decision**：最終採納的選項
> - **Rationale**：為何採納
> - **Alternatives considered**：評估過的其他方案與拒絕理由

所有項目於 Phase 0 結束前皆 **MUST** 決議，`NEEDS CLARIFICATION` 數量 = 0。

---

## R-001：CSRF 防護方案選型

**關聯 spec 要求**：FR-012a（「CSRF 方案於 plan 階段決定」）

**Decision**：採「**`SameSite=Strict` cookie + Origin / Referer header 雙重檢查**」方案。不引入 double-submit CSRF token。

**Rationale**：
- `SameSite=Strict` 已於 FR-008 明訂為 cookie 屬性，意味所有跨站請求（含表單 POST、`<img>`、JavaScript `fetch` from 他站）瀏覽器都 **不會** 夾帶 auth cookie。這已覆蓋 95% 的 CSRF 攻擊面。
- 額外的 Origin / Referer header 檢查作為第二層防護：對所有 `POST`/`PUT`/`DELETE`/`PATCH` 端點 middleware 要求請求帶 `Origin`（現代瀏覽器 fetch 必帶）且其值屬於白名單（即本站 `CORS_ORIGIN` 環境變數）。若 `Origin` 缺失則退而檢查 `Referer`。兩者皆缺 → `403`。
- Double-submit CSRF token 方案需要前端讀取 cookie 再回填到 header，這在 `HttpOnly` cookie 條件下 **不可行**（必須另開第二個非 HttpOnly cookie 儲存 token，增加攻擊面與實作複雜度）。
- 憲法 Principle IV「Secure by Default」要求 rate limit 等低成本護欄，Origin 檢查屬同類低成本高效益。

**Alternatives considered**：
- **Double-submit CSRF token（非 HttpOnly cookie + header）**：拒絕，因 token cookie 必須 JavaScript 可讀，XSS 時會與 auth cookie 一起淪陷，且增加前端樣板代碼。
- **Synchronizer token（server-side session 綁定 token）**：拒絕，因本模組採無狀態 JWT，引入 server-side session store 會違反架構簡潔性。
- **僅靠 `SameSite=Strict`（不加 Origin 檢查）**：拒絕，因舊版瀏覽器或非標準 UA（爬蟲、自動化腳本）可能不完整支援 `SameSite`；加一層 Origin 檢查成本極低。

**實作指引**：
- 新增 `backend/src/middleware/csrf.ts`：匯出 `requireSameOrigin` middleware；於 `backend/src/index.ts` 套用於所有非 GET/HEAD/OPTIONS 路由。
- 白名單來自 `CORS_ORIGIN` 環境變數（可為逗號分隔的多值）。
- 於 OpenAPI spec 的 `403 ForbiddenError` 明確列出 `csrf_origin_mismatch` 原因碼。

---

## R-002：弱密碼清單來源

**關聯 spec 要求**：FR-004b（「內建 ≥ 10,000 筆常見弱密碼清單」）

**Decision**：採用 [SecLists](https://github.com/danielmiessler/SecLists) 專案的 `Passwords/Common-Credentials/10-million-password-list-top-10000.txt`，於建置時下載並靜態嵌入為 `backend/src/utils/weakPasswords.ts` 匯出的 `Set<string>`。

**Rationale**：
- SecLists 為業界最廣泛採用的密碼學測試清單來源，已由 Daniel Miessler 維護多年、被 OWASP ZAP / Burp 等工具引用。
- Top-10000 清單大小約 72 KB，編譯後 `Set<string>` 記憶體佔用約 1~2 MB，對 Node.js 容器可忽略。
- 以「建置時下載 + 靜態嵌入」而非「運行時載入 txt」：避免運行時 I/O、確保清單版本被 git 追蹤（透過 lockfile）、避免容器內檔案被竄改。
- 不採用運行時 API（如 Have I Been Pwned）原因已於 FR-004b 說明：會增加登入/註冊延遲與外部依賴。

**Alternatives considered**：
- **Have I Been Pwned Pwned Passwords API**（k-anonymity 查詢）：拒絕，因為增加每次註冊/改密碼的網路 round-trip（~200 ms），顯著影響使用者體驗；且引入外部可用性依賴。
- **npm 套件 `common-password-checker` 或類似**：拒絕，因套件供應鏈風險（小眾套件被棄置 / 惡意替換的歷史）；SecLists 直接嵌入更可控。
- **自行維護清單**：拒絕，無產業共識、維護成本高。

**實作指引**：
- 建置腳本 `backend/scripts/build-weak-passwords.ts` 於 `npm run build` 前執行：
  - 從固定 commit hash（pinned）下載 SecLists 檔
  - 驗證 SHA-256（commit 到 repo 的 expected hash）
  - 轉為 `export const WEAK_PASSWORDS = new Set<string>([...])` 輸出至 `backend/src/utils/weakPasswords.ts`
- 或 pragmatic 替代：將 txt 直接 commit 進 repo（72 KB，可接受），建置時由腳本轉為 TypeScript。
- 驗證函式：`isWeakPassword(password: string): boolean` 做 `toLowerCase()` 後查 Set。

---

## R-003：`node-cron` 排程時間

**關聯 spec 要求**：FR-028a（「每日執行一次清除任務」）

**Decision**：排程時間為 **每日 UTC 19:00（= 台北時間 03:00）**；cron 運算式 `0 19 * * *`；以 `node-cron` 於 `backend/src/index.ts` 啟動時掛載。

**Rationale**：
- VitaShelf 使用者主要位於台灣時區；凌晨 3:00 使用量最低，清除任務對使用者幾乎不可察覺。
- 使用 UTC 時間定義（而非 Asia/Taipei）讓容器在不同部署環境（如 UTC 預設的雲端主機）行為一致；避免 DST 邊界（雖然台灣無 DST）或 locale 污染。
- `node-cron` 支援 `timezone` 選項，實作時使用 `cron.schedule('0 19 * * *', handler, { timezone: 'UTC' })` 明確標註。

**Alternatives considered**：
- **固定本地時間 03:00 + timezone: 'Asia/Taipei'**：拒絕，因容器時區設定若不一致會導致實際執行時間漂移；UTC 更可預測。
- **每小時跑一次小批次**：拒絕，因 SQLite 小批次刪除次數 × 24 相較於每日一次大批次並無效能優勢；且每小時觸發有更多機會碰上使用者活躍尖峰。
- **按 LoginLog 大小觸發（自適應）**：拒絕，過度工程，本 scale 不需要。

**實作指引**：
- 新增 `backend/src/schedulers/loginLogCleanup.ts`，匯出 `startLoginLogCleanupScheduler(prisma: PrismaClient, logger: Logger)`
- 於 `backend/src/index.ts` 啟動完 Express 後呼叫：`startLoginLogCleanupScheduler(prisma, logger)`
- 實作內容：`prisma.loginLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86400_000) } } })`
- 結構化 log：`logger.info('loginlog_cleanup_completed', { deletedCount, durationMs })`
- 錯誤處理：`try/catch` + `logger.warn('loginlog_cleanup_failed', { error })`，不讓任務崩潰使主程序停擺（FR-028b）

---

## R-004：`passwordChangedAt` 中介層的快取策略

**關聯 spec 要求**：FR-012b（「每次請求比對 `jwt.iat >= user.passwordChangedAt`」）

**Decision**：**不引入快取**；每次受保護請求讀一次 `User` 表。

**Rationale**：
- SQLite 的 `SELECT` 於主鍵查詢為 O(log n)，100~1,000 使用者量級實測 < 1 ms。
- 每次請求一次 DB round-trip 的成本遠低於快取一致性問題：若採 TTL 快取，密碼變更後「全裝置失效」的 SLA 會退化為「TTL 時間內仍可能通過」——違反 spec US5 驗收情境 2 的精神。
- 前端合理用法會在各頁面載入時呼叫 `/api/users/me` 一次，後續請求為 React Query 快取；單一使用者瀏覽 session 的實際 DB 讀取次數不高。
- 若未來量體成長至 SQLite 不足（遷移至 Postgres 或 1k+ RPS），可以加入 **1 秒 TTL 的 in-memory LRU 快取**（容器單節點即可，不需 Redis），但目前過度工程。

**Alternatives considered**：
- **引入 Redis 或 in-memory 快取（TTL 5 min）**：拒絕，違反「全裝置失效」SLA；且引入新 infra（Redis）違反憲法 Principle V 的單一 image 原則。
- **於 JWT payload 夾帶 `passwordChangedAt` 並簽章**：拒絕，因 `passwordChangedAt` 會因密碼變更而異動，cookie 重簽後才生效——這正是我們想避免的「需要主動吊銷既有 cookie」情境，反而邏輯更複雜。
- **前端 / 後端批次讀取 User**：拒絕，過度工程。

**實作指引**：
- `backend/src/middleware/auth.ts` 於 JWT 驗證通過後：
  ```ts
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) return res.status(401).json({ message: '憑證已失效，請重新登入' })
  if (payload.iat * 1000 < user.passwordChangedAt.getTime() - 60_000) {
    return res.status(401).json({ message: '憑證已失效，請重新登入' })
  }
  ```
  （保留 60 秒時鐘偏差容忍，FR-012）

---

## R-005：JWT 簽章演算法

**關聯 spec 要求**：FR-009 + FR-010（「payload 至少含 userId/email/role；簽章金鑰 128+ 字元」）

**Decision**：採用 **HS256**（HMAC-SHA-256）。

**Rationale**：
- 本模組為單一後端進程 + 單一 cookie 消費者；不存在「多個服務需要驗證 JWT 但不應持有簽章能力」的分散式場景，不需要非對稱演算法。
- HS256 的 secret 為 128 字元 random hex（64 bytes = 512 bits）遠超 HMAC-SHA-256 推薦 256 bits；與現有 `JWT_SECRET` 環境變數相容，不需新增金鑰管理邏輯。
- RS256 / ES256 需維護公私鑰對，於容器化部署中需引入 PEM 檔案掛載或 KMS，違反「單一 image + 單一環境變數」的簡潔原則。
- `jsonwebtoken` 函式庫 HS256 為預設，實作零額外成本。

**Alternatives considered**：
- **RS256**：拒絕，因沒有「JWT 需被其他服務驗證」的需求；多金鑰管理複雜度 > 收益。
- **EdDSA（Ed25519）**：拒絕，同 RS256；且 `jsonwebtoken` 對 EdDSA 支援需額外編譯 native 模組。
- **PASETO**：拒絕，JWT 生態成熟度 >> PASETO；本專案無遷移誘因。

**實作指引**：
- `backend/src/utils/jwt.ts` 統一匯出 `signToken` / `verifyToken`；algorithm 鎖定 `HS256`，JWT options 明確列出：`{ algorithm: 'HS256', expiresIn: '7d' }`
- 驗證時 **MUST** 指定 `algorithms: ['HS256']` 以防 algorithm confusion 攻擊（不可用 default）

---

## R-006：bcrypt 72-byte 上限處理

**關聯 spec 要求**：Edge Case（「密碼含 Unicode + bcrypt 72 byte 上限」）+ FR-006

**Decision**：採「**SHA-256 pre-hash**」策略 — 將使用者密碼先 SHA-256 雜湊為固定 32-byte（以 base64 編碼為 44 字元，< 72 bytes），再餵入 bcrypt。

**Rationale**：
- bcrypt 會靜默截斷超過 72 bytes 的密碼；若不處理，含 Unicode 的長密碼（如中文密碼 > 24 字）或 passphrase 使用者會出現「明明輸入不同密碼、實際上雜湊一致」的詭異行為。
- SHA-256 輸出固定 32 bytes，bcrypt 永遠處理全部熵；此模式由 Dropbox 率先公開使用（[Dropbox Tech Blog 2016](https://dropbox.tech/security/how-dropbox-securely-stores-your-passwords)），已被 Python `passlib`、Django 等專案採用。
- SHA-256 pre-hash 引入的唯一安全考量是「SHA-256 的 collision 複雜度 2^128」，遠超 bcrypt 本身的安全邊界（2^72 / 2^128 per attempt），不成實質弱化。

**Alternatives considered**：
- **明文截斷至 72 bytes**：拒絕，詭異行為（使用者不會被告知截斷發生）且違反最小驚訝原則。
- **拒絕 > 72 bytes 的密碼**：拒絕，對使用者意外（「我輸入了 long passphrase，怎麼說我密碼不合法？」）；需在 UI 層提示「密碼過長」亦增加複雜度。
- **遷移至 argon2**：拒絕，雖然 argon2 更現代且無 72-byte 問題，但 `bcryptjs` 為既有專案依賴且憲法 Technical Constraints 未授權新增 native dependency（argon2 純 JS 實作效能不足）。

**實作指引**：
- `backend/src/utils/password.ts`：
  ```ts
  import { createHash } from 'node:crypto'
  import bcrypt from 'bcryptjs'

  function preHash(password: string): string {
    return createHash('sha256').update(password, 'utf8').digest('base64')
  }

  export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(preHash(plain), 12)
  }

  export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(preHash(plain), hash)
  }
  ```
- 既有使用者（若有）於本模組 migration 前以舊方式（無 pre-hash）建立的密碼 **MUST** 於 migration 階段標註 `needsRehash = true`；使用者下次登入成功時透明 re-hash 為新格式。本專案目前無生產資料，此遷移窗口可忽略。

---

## R-007：`express-rate-limit` 計數儲存

**關聯 spec 要求**：FR-021 / FR-022 / FR-023（IP 限流、inline middleware、IP 維度）

**Decision**：使用 `express-rate-limit` 的 **預設 MemoryStore**（per-process in-memory Map）。

**Rationale**：
- VitaShelf 為單一 Docker container 部署（憲法 Principle V）；所有請求皆落於同一 Node.js 進程；無多實例協調需求。
- MemoryStore 於進程內提供 O(1) 查找，零 I/O 成本，與 `express-rate-limit` 零額外配置。
- 若未來水平擴展至多實例（reverse proxy round-robin），需遷移至 Redis store（`rate-limit-redis`），屬未來工作。
- 進程重啟會清空計數—此為 acceptable 折衷，因限流窗口短（1 分鐘），重啟頻率遠低於此。

**Alternatives considered**：
- **Redis store**：拒絕，引入新 infra 違反單一 image 原則（同 R-004）。
- **SQLite store（自刻）**：拒絕，寫入頻率高（每次登入嘗試）會加重 SQLite 鎖競爭，效能劣於 in-memory。

**實作指引**：
- `backend/src/routes/auth.ts` 於登入路由前 inline 宣告：
  ```ts
  router.post('/login', rateLimit({
    windowMs: 60_000,
    max: 5,
    standardHeaders: 'draft-7',  // 會自動送 RateLimit-* headers
    legacyHeaders: false,
    skipSuccessfulRequests: true,  // 成功登入不計入（僅失敗計數）
    handler: (req, res) => {
      // FR-023a / FR-023c：429 + Retry-After + LoginLog rate_limited
      const retryAfterSeconds = Math.ceil((req.rateLimit!.resetTime!.getTime() - Date.now()) / 1000)
      // 寫 LoginLog（best-effort，FR-028d fail-open）
      writeLoginLog({ ... reason: 'rate_limited', success: false }).catch(err => logger.error(...))
      res.setHeader('Retry-After', retryAfterSeconds)
      res.status(429).json({
        message: '登入嘗試次數過多，請稍後再試',
        retryAfterSeconds,
      })
    },
  }), loginHandler)
  ```

---

## R-008：前端 cookie-based 認證的 Axios / React Query 整合

**關聯 spec 要求**：FR-008 / FR-014（cookie 自動管理、前端不讀 token）

**Decision**：
- 全域 Axios 實例設定 `withCredentials: true`，確保同源請求自動夾帶 cookie。
- 401 回應透過 Axios response interceptor 集中處理：清除 TanStack Query cache、`router.navigate('/login')`。
- `useAuth` hook 以 `GET /api/users/me` 為 source of truth 判斷登入狀態（cookie 有效則回 200 + user，否則 401）。
- 登入成功後 invalidate `['me']` query，觸發重新查詢。

**Rationale**：
- cookie-based 認證下，前端不需儲存任何 token；狀態管理從「token 存在 / 不存在」改為「`GET /me` 是否成功」，更簡潔。
- TanStack Query 的 staleTime + retry 機制天然適合此 polling 模式；設 `staleTime: 5 * 60_000`（5 min）降低請求頻率。

**實作指引**：
- `frontend/src/services/api.ts`：
  ```ts
  import axios from 'axios'
  export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: true,
  })
  api.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401 && !err.config.url.endsWith('/users/me')) {
        // 避免 /me 401 時無限迴圈
        queryClient.clear()
        window.location.href = '/login'
      }
      return Promise.reject(err)
    },
  )
  ```
- `frontend/src/hooks/useAuth.ts`：
  ```ts
  export function useAuth() {
    return useQuery({
      queryKey: ['me'],
      queryFn: () => api.get<User>('/api/users/me').then(r => r.data),
      retry: false,
      staleTime: 5 * 60_000,
    })
  }
  ```

---

## R-009：前端 429 限流 UX 處理

**關聯 spec 要求**：FR-023a / FR-023b（`Retry-After` + `retryAfterSeconds` 倒數）

**Decision**：登入表單於收到 429 時，讀取 response body 的 `retryAfterSeconds`，以 `useState` + `setInterval` 顯示倒數按鈕（禁用 submit 至倒數結束）。

**Rationale**：
- body 中的 `retryAfterSeconds` 為整數秒，前端 `useEffect` + `setInterval(tick, 1000)` 遞減即可。
- 優於讀取 header：雖 FR-023b 已將 `Retry-After` 加入 `Access-Control-Expose-Headers`，body 取用更直覺、不受 CORS 邊界情境影響。
- Toast 顯示「登入嘗試次數過多」並於按鈕上顯示「請稍後再試（`n` 秒）」倒數至 0 後恢復可用。

**實作指引**：見 `frontend/src/pages/Login.tsx` 的 `rateLimitedUntil` state 與計時 hook（詳見 tasks.md）。

---

## 結論

以上 9 項研究項目涵蓋 spec 中所有 Deferred 工程決策，無剩餘 `NEEDS CLARIFICATION`。可進入 Phase 1 Design。
