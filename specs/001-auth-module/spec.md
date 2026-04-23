# 功能規格書：認證模組（Auth Module）

**Feature Branch**: `001-auth-module`
**Created**: 2026-04-23
**Status**: Draft
**Input**: 使用者描述：「提供使用者註冊、登入、登出、個人資料維護與密碼變更功能，並包含登入稽核與暴力破解防護。」

> **憲法對齊**：本文件依據 [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) v1.1.0 撰寫。
> - **Principle I（繁體中文文件）**：本規格以繁體中文（zh-TW）撰寫。
> - **Principle II（OpenAPI 3.2 Contract-First）**：本模組所有對外 HTTP 介面將於 `contracts/` 下以 `openapi: 3.2.x` 規格先行定義，再進入 `/speckit.plan` 與 `/speckit.tasks`；本 spec 僅描述行為與資料面貌，不固定實作層細節。

---

## Clarifications

### Session 2026-04-23

- Q: 登入憑證（JWT）於前端的儲存位置為何？ → A: httpOnly + Secure + SameSite=Strict cookie（後端以 `Set-Cookie` 下發；登入回應本體不含 token 明文；需配套 CSRF token 保護狀態改變端點）。
- Q: 帳號狀態模型是否引入自動鎖定或管理員停用？ → A: 僅管理員停用旗標（`User.isActive`，預設 `true`）；不引入自動鎖定（仰賴 IP 層限流）。
- Q: LoginLog 保留期策略？ → A: 保留 90 天；以 `node-cron` 每日排程刪除 `createdAt < now - 90d` 的紀錄。
- Q: 登入限流（429）的回應合約？ → A: `HTTP 429` + `Retry-After: <seconds>` header + body `{ message, retryAfterSeconds }`（header 與 body 同時提供秒數，前端可直接顯示倒數）。
- Q: Email 正規化的正準形式範圍？ → A: 僅 `trim + lowercase`；**不** 做 Gmail 別名（`.` / `+tag`）展開；`foo+tag@gmail.com` 與 `foo@gmail.com` 視為不同帳號。
- Q: 密碼複雜度規則？ → A: NIST SP 800-63B 風格 — 長度 ≥ 8 且 **不** 強制字元類別；以內建 top-10,000 常見弱密碼清單比對，命中則拒絕。
- Q: 密碼變更後既有會話如何處理？ → A: **全會話失效 + 強制重新登入**（Option D）— User 新增 `passwordChangedAt`；JWT 驗證時比對 `jwt.iat < user.passwordChangedAt` 視為過期；變更密碼端點本身也清除當前 cookie，使所有裝置（含發起變更的裝置）下次請求即被拒絕、必須重新登入。
- Q: `LoginLog` 寫入失敗時的登入流程行為？ → A: **Fail-open + error log** — 稽核寫入失敗 **不** 中斷登入流程；以 winston error 等級記錄失敗事件（含原始錯誤與當次登入的 email、ip、success），供運維事後察覺稽核遺失。
- Q: 同一帳號的併發會話上限？ → A: **不設上限**；不引入 session 追蹤表；異常情境（帳號疑似遭盜）由使用者自行變更密碼觸發「全裝置失效」處理（FR-012b / FR-020a-c）。

---

## 1. 使用者情境與測試（User Scenarios & Testing）*（必填）*

> **優先度慣例**：P1 = 必要 MVP（缺此無法使用）；P2 = 次要但重要（可獨立上線）；P3 = 加值體驗。
> 每則故事皆為「可獨立測試」單位 — 只實作其中一則仍可構成可交付切片。

### 使用者故事 1 — 以 Email + 密碼註冊帳號（Priority: P1）

身為 **新訪客**，我希望能以 email + 密碼搭配顯示名稱註冊帳號，以便開始建立屬於自己的庫存資料。若系統目前關閉公開註冊，應以明確訊息告知我，而非靜默失敗或出現不相關錯誤。

**為何此優先度**：沒有註冊就沒有使用者；這是所有其他功能的前置。註冊體驗不佳會直接阻擋 80% 的新用戶入口。

**獨立測試方式**：可於未登入狀態，以一組合法 email + 合法密碼 + 顯示名稱呼叫註冊流程，並驗證：
1. 成功情境：帳號被建立、可以立即以該帳號登入。
2. 公開註冊關閉情境：同一組輸入被明確拒絕，訊息為「目前不開放註冊」，且資料庫中未建立該使用者。

**驗收情境（Acceptance Scenarios）**：

1. **Given** 系統目前允許公開註冊、email `alice@example.com` 尚未註冊，
   **When** 新訪客以 `alice@example.com` + 密碼 `Str0ng!Pass` + 顯示名稱「Alice」送出註冊，
   **Then** 系統建立該帳號（角色預設 USER、認證來源為 LOCAL、主題預設 light），並於下一步登入時能成功。
2. **Given** 系統管理員已關閉公開註冊，
   **When** 新訪客送出任何註冊請求，
   **Then** 系統以「目前不開放註冊」（403）拒絕，且資料庫未建立任何新使用者。
3. **Given** email `bob@example.com` 已存在，
   **When** 新訪客以 `bob@example.com` 送出註冊，
   **Then** 系統以「帳號已存在」（409）拒絕，且已存在使用者的資料未被異動。
4. **Given** 任意輸入，
   **When** 送出的 email 不符合 email 格式（如 `not-an-email`）或密碼長度不足 8 字，
   **Then** 系統以對應錯誤訊息（「email 格式錯誤」400 / 「密碼至少需 8 字元」400）拒絕，且資料庫未建立使用者。
5. **Given** 新訪客送出長度 ≥ 8 字但屬常見弱密碼（如 `password123`、`12345678`、`qwerty12`）的註冊請求，
   **When** 系統比對內建常見弱密碼清單（≥ 10,000 筆），
   **Then** 系統以「此密碼過於常見，請改用較不易被猜中的密碼」（400）拒絕；資料庫未建立使用者。

---

### 使用者故事 2 — 以 Email + 密碼登入並取得登入憑證（Priority: P1）

身為 **已註冊使用者**，我希望能以 email + 密碼登入系統並取得一個有效一段時間的登入憑證，以便後續存取屬於自己的產品、購買、庫存等受保護 API 與頁面。

**為何此優先度**：沒有登入就無法使用任何受保護功能；此為使用頻率最高的入口行為。

**獨立測試方式**：以一組已註冊且合法的 email + 正確密碼呼叫登入流程，驗證取得的憑證可用於存取受保護端點；再以錯誤密碼驗證系統統一回覆「帳號或密碼錯誤」，無法從錯誤訊息推論帳號是否存在。

**驗收情境**：

1. **Given** 使用者 `alice@example.com` 已註冊且密碼為 `Str0ng!Pass`，
   **When** 她以正確的 email + 密碼送出登入，
   **Then** 系統以 `Set-Cookie: token=<JWT>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800` 下發憑證；HTTP 回應本體僅含 `{ user }`（至少包含 `id`、`email`、`displayName`、`role`、`theme`），**不包含** `token` 明文欄位；瀏覽器後續請求自動夾帶該 cookie，可立即存取受保護端點。
2. **Given** 使用者 `alice@example.com` 已註冊，
   **When** 她以錯誤密碼送出登入，
   **Then** 系統以「帳號或密碼錯誤」（401）拒絕。
3. **Given** 不存在的 email `ghost@example.com`，
   **When** 有人以該 email + 任意密碼送出登入，
   **Then** 系統以「帳號或密碼錯誤」（401）拒絕 — 與上一則回應完全一致，無法藉此推論帳號是否存在。
4. **Given** 使用者登入成功，
   **When** 7 天又 1 分鐘後以相同 cookie 呼叫受保護端點，
   **Then** 系統以「憑證已過期」（401）拒絕，瀏覽器因 `Max-Age` 到期亦不再夾帶該 cookie；使用者需重新登入。

---

### 使用者故事 3 — 登出並立即失效當前裝置憑證（Priority: P1）

身為 **使用者**，我希望能登出並讓目前裝置上的登入憑證立即失效，以便在共用或公共裝置上保護我的資料。

**為何此優先度**：在共用裝置情境下，未登出等同留門；這是基本安全期待。

**獨立測試方式**：在登入狀態下呼叫登出，確認前端立即清除憑證、後端對應端點確認登出流程回應成功；後續該裝置無法再存取需登入的頁面。

**驗收情境**：

1. **Given** 使用者已於裝置 A 登入，
   **When** 她按下登出，
   **Then** 後端回覆 `Set-Cookie: token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0`（清除 cookie）；前端導回登入頁；同一裝置未重新登入前，瀏覽器不再夾帶 auth cookie，無法進入任何受保護頁面。
2. **Given** 使用者同時在裝置 A、裝置 B 登入，
   **When** 她於裝置 A 登出，
   **Then** 裝置 A 的 cookie 被伺服器清除指令移除；裝置 B 的既有 cookie 仍在其到期時間內可用（本模組不維護憑證黑名單）。

---

### 使用者故事 4 — 查看與更新個人資料（顯示名稱、主題）（Priority: P2）

身為 **使用者**，我希望能查看並更新自己的顯示名稱與主題偏好（深色 / 淺色），以便個人化使用體驗。

**為何此優先度**：屬於個人化加值，非核心存取路徑；但對留存與滿意度有明顯影響，可獨立切片上線。

**獨立測試方式**：登入後取得個人資訊，驗證回傳欄位；再更新顯示名稱與主題、重新取得，確認已持久化。

**驗收情境**：

1. **Given** 使用者已登入且顯示名稱為「Alice」、主題為 `light`，
   **When** 她呼叫「取得我的資訊」，
   **Then** 系統回傳 `{ id, email, displayName: "Alice", role, theme: "light", authProvider }`，不回傳密碼相關欄位。
2. **Given** 使用者已登入，
   **When** 她將顯示名稱更新為「Alice Chen」、主題更新為 `dark`，
   **Then** 下一次「取得我的資訊」時回傳新值；其他欄位（如 email、role）未被異動。
3. **Given** 使用者嘗試透過更新個人資料的端點修改自己的 `role` 或 `email`，
   **Then** 此類欄位被系統忽略或明確拒絕（僅 `displayName` 與 `theme` 可由此路徑修改）。

---

### 使用者故事 5 — 在驗證舊密碼後變更新密碼（Priority: P2）

身為 **使用者**，我希望能在成功驗證舊密碼後將密碼變更為新密碼，以便定期更新以維持安全。

**為何此優先度**：核心登入已可運作，但長期使用勢必需要密碼輪替；同時也是風控基本需求。

**獨立測試方式**：登入後以正確舊密碼 + 符合規則的新密碼變更，驗證變更後可用新密碼登入、舊密碼失效；再以錯誤舊密碼嘗試變更，驗證被拒且密碼未變。

**驗收情境**：

1. **Given** 使用者 `alice@example.com` 的密碼為 `OldPass!234`，
   **When** 她提供舊密碼 `OldPass!234` + 新密碼 `NewPass!5678`，
   **Then** 系統於同一 transaction 更新 `password` 與 `passwordChangedAt`；回應以 `Set-Cookie: token=; Max-Age=0` 清除當前 cookie，body 為 `{ message: "密碼已更新，請重新登入" }`；使用者被導回登入頁；她需以新密碼 `NewPass!5678` 重新登入；以 `OldPass!234` 登入一律以「帳號或密碼錯誤」失敗。
2. **Given** 使用者已於裝置 A（發起變更）與裝置 B（同帳號他處登入）皆有有效 cookie，
   **When** 她於裝置 A 完成密碼變更，
   **Then** 裝置 A 的 cookie 於回應被清除；裝置 B 於下次任何受保護請求時，JWT 驗證中介層檢測到 `jwt.iat < user.passwordChangedAt`，回 `401` 並要求重新登入；兩裝置皆無法繼續使用舊 cookie。
3. **Given** 使用者已登入，
   **When** 她提供錯誤的舊密碼 + 任意新密碼，
   **Then** 系統拒絕變更；資料庫中的 `password` 與 `passwordChangedAt` 皆未被改動；當前 cookie 仍有效、其他裝置 cookie 亦仍有效。
4. **Given** 使用者已登入，
   **When** 她提供正確的舊密碼 + 長度不足 8 字或屬常見弱密碼的新密碼，
   **Then** 系統以對應錯誤（「密碼至少需 8 字元」400 / 「此密碼過於常見」400）拒絕；資料庫未被改動。

---

### 使用者故事 6 — 登入失敗限流與稽核紀錄（Priority: P2）

身為 **安全敏感使用者**，我希望系統在同一來源連續登入失敗時暫時限制嘗試次數，並把每次登入失敗事件（時間、email、IP、來源國家、失敗原因）保存下來供事後稽核，以便我的帳號不易被暴力破解、管理員能偵測異常存取行為。

**為何此優先度**：核心登入已可運作，但缺乏限流與稽核將使帳號在公開部署時迅速暴露於暴力破解；此原則同時由憲法 Principle IV 要求。

**獨立測試方式**：對同一 IP 送出 5 次錯誤密碼的登入請求，驗證第 6 次（同分鐘內）被限流擋下；於稽核資料查詢介面確認 5 次失敗均有完整紀錄；合法使用者從不同 IP 嘗試則不受先前同帳號失敗影響。

**驗收情境**：

1. **Given** 同一來源 IP 於 1 分鐘內已連續 5 次以錯誤密碼嘗試登入 `alice@example.com`，
   **When** 該 IP 於同一分鐘內發出第 6 次登入（不論帳號是否正確），
   **Then** 系統以 `HTTP 429 Too Many Requests` 拒絕；回應 header 含 `Retry-After: <n>`（整數秒數），body 為 `{ message: "登入嘗試次數過多，請稍後再試", retryAfterSeconds: <n> }`，兩處的秒數一致；此限流事件 **不** 觸發 bcrypt 比對；LoginLog 寫入一筆 `reason = "rate_limited"` 的失敗紀錄。前端可由 `retryAfterSeconds` 顯示倒數。
2. **Given** 使用者登入失敗任何一次（密碼錯、帳號不存在、限流等），
   **Then** 系統 **必須** 於 `LoginLog` 寫入一筆紀錄，含：`timestamp`、`email`（使用者送出的值，即使不存在）、`ip`、`country`（由 IP 查出，查不到時為空字串）、`method = "local"`、`success = false`、`reason`（失敗原因分類）。
3. **Given** 合法使用者於 IP A 被限流，
   **When** 同一合法使用者於 IP B 以正確密碼登入，
   **Then** IP B 的登入成功；限流僅以「來源 IP + 時間窗」為單位，不因其他 IP 的失敗紀錄而影響此帳號。
4. **Given** `LoginLog` 中已累積多筆紀錄，
   **When** 管理員以管理員模組介面查詢登入稽核（不在本模組範圍），
   **Then** 能看到本模組寫入的完整紀錄；欄位缺漏率為 0%。

---

### 邊界條件（Edge Cases）

- **Email 大小寫**：使用者以 `Alice@Example.com` 註冊、以 `alice@example.com` 登入（或反之）— 系統 **MUST** 將 email 正規化為小寫後儲存與比對。
- **Email 含前後空白**：使用者輸入含空白的 email（`" alice@example.com "`）— 系統 **MUST** trim 後再驗證格式，避免「有空白版」與「無空白版」共存。
- **Email 別名（Gmail `+tag` 與 `.`）**：`foo+promo@gmail.com`、`foo.bar@gmail.com`、`foo@gmail.com` 在本模組視為 **三個不同帳號**；系統 **MUST NOT** 進行 provider-specific 別名展開（FR-003a）。使用者若以 `+tag` 的變體註冊多個帳號屬其自由；防濫用由管理員停用（FR-011a）與 IP 限流（FR-021）負責，不由 email 正規化負責。
- **Unicode / 全形 email**：若輸入 `alice＠example.com`（全形 @）— 視為不合法 email 格式，回「email 格式錯誤」。
- **顯示名稱為空白字串或僅空白**：視為未提供，以驗證錯誤拒絕（顯示名稱為必填）。
- **密碼含 Unicode**：允許，長度以 UTF-8 code points 計算（≥ 8）；bcrypt 對長密碼有 72 byte 上限，實作時 **MUST** 明確處理（預先截斷或以 pre-hash 處理）。
- **時鐘偏移**：JWT `exp` 需有合理的時鐘偏差容忍（± 60 秒）以避免分散部署的小幅時間差異導致瞬間失效。
- **限流重置**：同一 IP 限流視窗結束後，計數歸零；不保留跨視窗累積。
- **註冊競態**：兩個請求同時以相同 email 註冊 — 由於 email 有唯一性約束，僅其中一個會成功，另一個會得到「帳號已存在」（409）。
- **環境變數缺漏**：系統啟動時若未設定 JWT 簽章密鑰，**MUST** 自動產生一組高強度隨機值（記錄於啟動 log，以提醒營運者設定固定值）；此情境下容器 **SHOULD NOT** 無聲啟動。
- **登出後 token 重放**：因不維護黑名單，理論上已登出但未過期的 token 在他人持有下仍可使用 — 此為本模組 **已知接受範圍**；高安全需求之未來版本可引入黑名單或 refresh token。
- **跨網域部署**：auth cookie 設定 `SameSite=Strict`，因此 API 與前端 **MUST** 共用同一個可註冊網域（eTLD+1）；若前後端分離於不同網域，**MUST** 先走憲法修訂流程改為 `SameSite=Lax` 或另採 CORS + credentialed 設計。
- **CSRF 保護**：由於憑證改以 cookie 自動夾帶，所有狀態改變端點（POST/PUT/DELETE/PATCH）**MUST** 要求同源請求或 CSRF token 搭配 `SameSite=Strict` 雙重防護；純 GET 讀取端點依 same-origin + `SameSite=Strict` 已足。
- **非瀏覽器客戶端**：純 API 整合（如命令列腳本）因無 cookie jar 可能不便；此情境 **不在本模組 v1 支援範圍**，屬未來版本需求。
- **已登入使用者被管理員即時停用**：因本模組不維護 token 黑名單，使用者現有 JWT cookie 仍可使用至該 JWT 到期（最長 7 天）；使用者登出後便無法重新登入。此為 **已知接受範圍**；需即時撤銷則屬未來版本（可引入黑名單或縮短 JWT 壽命 + refresh token）。此情境下 **MUST** 於 `LoginLog` 寫入 `reason = "account_disabled"` 的失敗紀錄以供稽核。

---

## 2. 需求（Requirements）*（必填）*

### 2.1 功能性需求（Functional Requirements）

**帳號建立與輸入驗證**

- **FR-001**：系統 **MUST** 允許新訪客以 `email` + `password` + `displayName` 建立帳號；成功後新帳號的角色為 `USER`、認證來源為 `LOCAL`、主題預設為 `light`。
- **FR-002**：系統 **MUST** 於註冊前驗證 email 符合 RFC 5322 合法格式；不合法則以「email 格式錯誤」（400）拒絕。
- **FR-003**：系統 **MUST** 於註冊前驗證 email 在資料庫中尚未存在（以「正規化後字串」比對）；已存在則以「帳號已存在」（409）拒絕。
- **FR-003a**：Email 正規化（canonical form）**MUST** 僅套用：`String.prototype.trim()` + `String.prototype.toLowerCase()`。**MUST NOT** 移除 local-part 中的 `.`、**MUST NOT** 移除 `+tag` 後綴、**MUST NOT** 對任何網域（含 `@gmail.com`、`@googlemail.com`）套用 provider-specific 別名規則。因此 `foo+tag@gmail.com` 與 `foo@gmail.com` 視為 **不同** 帳號。此正規化規則同時用於註冊查重（FR-003）與登入查詢（FR-008）以確保對稱。
- **FR-004**：系統 **MUST** 於註冊與密碼變更前驗證密碼長度 ≥ 8 字（UTF-8 code points）；不足則以「密碼至少需 8 字元」（400）拒絕。
- **FR-004a**：系統 **MUST NOT** 強制密碼需含大寫、小寫、數字或特殊字元的字元類別組合（NIST SP 800-63B 風格；避免使用者創造 `P@ssw0rd!` 式可預測模式）。
- **FR-004b**：系統 **MUST** 將待驗證密碼（經 `toLowerCase()` 後的正規化值）與 **內建** 的常見弱密碼清單比對；清單 **MUST** 包含至少 **10,000** 筆業界公開的常見弱密碼（如 SecLists 的 `10k-most-common.txt` 或同等清單）；命中則以「此密碼過於常見，請改用較不易被猜中的密碼」（400）拒絕。清單 **MUST** 隨應用程式打包於容器內，**MUST NOT** 於運行時呼叫外部 API 以查詢（避免增加登入/註冊延遲與外部依賴）。
- **FR-004c**：弱密碼檢查 **MUST** 在資料庫寫入前執行；失敗情境不得於 `User` 資料表留下任何痕跡（即：驗證未通過的密碼 **MUST NOT** 產生資料庫異動）。
- **FR-005**：系統 **MUST** 驗證 `displayName` 經 trim 後非空；否則以驗證錯誤拒絕。
- **FR-006**：系統 **MUST** 在儲存前以單向雜湊處理密碼（bcrypt，cost factor ≥ 12）；明文密碼 **MUST NOT** 出現在資料庫、log、回應或任何可還原的儲存媒介中。

**公開註冊開關**

- **FR-007**：系統 **MUST** 於處理註冊前讀取「管理員設定」中的 `registrationOpen` 旗標；若為 `false`，**MUST** 以「目前不開放註冊」（403）拒絕所有註冊請求，即使其他欄位完全合法。

**登入與憑證簽發**

- **FR-008**：系統 **MUST** 允許已註冊使用者以 email + 密碼登入；成功時以 HTTP header `Set-Cookie: token=<JWT>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800` 下發憑證，**HTTP 回應本體僅含 `{ user }`**（至少包含 `id`、`email`、`displayName`、`role`、`theme`、`authProvider`），**MUST NOT** 於回應本體夾帶 `token` 明文或任何密碼相關欄位。
- **FR-009**：系統 **MUST** 以 JWT 作為登入憑證；payload 至少包含 `userId`、`email`、`role`；有效期 7 天（`Max-Age=604800` 同步）。JWT **MUST NOT** 由 JavaScript 可讀之儲存位置（localStorage、sessionStorage、非 HttpOnly cookie）提供或回傳。
- **FR-010**：JWT 簽章密鑰 **MUST** 由環境變數注入（建議 128 字元以上亂數）；若啟動時未設定，系統 **MUST** 自動產生一組高強度隨機值並於啟動 log 明確警示營運者設定固定值（憲法 Principle IV）。
- **FR-011**：密碼錯誤與帳號不存在 **MUST** 統一以「帳號或密碼錯誤」（401）回應；不得透露帳號是否存在。
- **FR-011a**：登入流程 **MUST** 於密碼比對成功後、簽發 JWT 前檢查 `User.isActive`；若為 `false`，**MUST** 以「帳號已被停用」（403）拒絕，且 **MUST NOT** 簽發 cookie。此檢查與「帳號或密碼錯誤」的 401 時序差必須盡量小化（實作上仍應於密碼驗證後再檢查，以避免「帳號存在 / 不存在」時序 oracle；但「帳號停用 / 啟用」的可觀測差異屬 **已知接受範圍**，因停用狀態由管理員主動設定、不為攻擊面）。
- **FR-011b**：系統 **MUST NOT** 在本模組實作自動帳號鎖定；暴力破解防護由 FR-021 的 IP 層級限流負責。若未來引入自動鎖定，**MUST** 先走憲法修訂或本規格版本升級。
- **FR-012**：系統 **MUST** 從請求 cookie 中的 `token` 欄位解析與驗證 JWT 以存取所有受保護端點；token 過期後 **MUST** 拒絕並要求重新登入（時鐘偏差容忍 ± 60 秒）。**MUST NOT** 從 `Authorization` header 或 request body 接受 token（避免多通道漂移）。
- **FR-012b**：JWT 驗證中介層 **MUST** 於每次受保護請求中，讀取 JWT 簽章與到期時間通過後，額外比對 `jwt.iat >= user.passwordChangedAt`（以秒為單位比較）；若 `jwt.iat < user.passwordChangedAt`，視為 **已由密碼變更吊銷**，以「憑證已失效，請重新登入」（401）拒絕。此比對 **MUST** 為每次請求執行（需 1 次 `User` 讀取），以確保密碼變更後所有裝置於下次請求即失效。
- **FR-012a**：所有狀態改變端點（非 GET/HEAD/OPTIONS）**MUST** 套用 CSRF 防護；可採「`SameSite=Strict` + 同源 Origin/Referer 檢查」或「double-submit CSRF token」任一方案，選擇於 plan 階段決定並於 OpenAPI 3.2 spec 註明。

**登出與會話**

- **FR-013**：系統 **MUST** 提供登出端點；後端 **MUST** 以 `Set-Cookie: token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0` 明確清除 auth cookie；**MUST NOT** 維護 token 黑名單（單純仰賴 cookie 清除 + 到期）。
- **FR-013a**：同一帳號的併發會話（多裝置/多瀏覽器）**MUST NOT** 設上限；不引入 `UserSession` 或同等 session 追蹤資料表。使用者若懷疑帳號遭盜，**MUST** 透過變更密碼（FR-020a）一次性使所有裝置的 cookie 失效（見 FR-012b）。此折衷為 **已知接受範圍**；若未來需要「使用者可見的活躍裝置清單」或「並發上限」，屬未來版本需求，**MUST** 先走憲法修訂或本規格升版。
- **FR-014**：前端 **MUST** 於登出後將使用者導回登入頁；因 token 儲存於 HttpOnly cookie，前端 **MUST NOT**（也無法）以 JavaScript 讀取或寫入 token；登出時前端僅呼叫登出端點、不再自行管理憑證。

**個人資料**

- **FR-015**：系統 **MUST** 提供「取得我的資訊」端點；僅回傳 `id`、`email`、`displayName`、`role`、`theme`、`authProvider`（以及 `createdAt` / `updatedAt` 等非敏感欄位），**MUST NOT** 回傳密碼雜湊或 `googleId`。
- **FR-016**：系統 **MUST** 提供「更新個人資料」端點；允許變更 `displayName` 與 `theme`；其他欄位（`email`、`role`、`password` 等）**MUST** 被忽略或明確拒絕。
- **FR-017**：`theme` 值 **MUST** 為 `"light"` 或 `"dark"`；其他值以驗證錯誤拒絕。

**密碼變更**

- **FR-018**：系統 **MUST** 提供密碼變更端點；要求使用者提供正確的 `oldPassword` 與符合規則的 `newPassword`。
- **FR-019**：若 `oldPassword` 與資料庫雜湊不符，系統 **MUST** 拒絕變更且 **MUST NOT** 修改密碼雜湊；回應與登入失敗一致的「帳號或密碼錯誤」語意（401）。
- **FR-020**：`newPassword` **MUST** 滿足與註冊相同的密碼規則（長度 ≥ 8 字 + 弱密碼清單檢查，見 FR-004 / FR-004a / FR-004b）；不滿足則以對應錯誤訊息拒絕。
- **FR-020a**：密碼變更成功時，系統 **MUST** 於同一資料庫交易（transaction）中：(1) 更新 `User.password` 為新的 bcrypt 雜湊；(2) 將 `User.passwordChangedAt` 設為當前 UTC 時間（以秒為單位，與 JWT `iat` 對齊）。兩者 **MUST** atomic；部分更新 **MUST NOT** 發生。
- **FR-020b**：密碼變更成功的回應 **MUST** 同時包含 `Set-Cookie: token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`（清除當前 cookie）；回應 body 為 `{ message: "密碼已更新，請重新登入" }`；HTTP 狀態碼為 `200`。**MUST NOT** 於此端點自動簽發新 cookie（即：變更密碼後所有裝置——包含當前裝置——皆需重新登入）。
- **FR-020c**：於密碼變更成功後，使用者其他裝置（或同裝置不同瀏覽器分頁）上的既有 cookie **MUST** 於下次受保護請求被 FR-012b 的 `jwt.iat < passwordChangedAt` 檢查判定為失效，並以 `401` 拒絕。

**登入限流**

- **FR-021**：系統 **MUST** 對登入端點套用速率限制 middleware；同一來源 IP **MUST** 於 1 分鐘時間窗內最多允許 5 次登入失敗；第 6 次開始的請求在該視窗內 **MUST** 被擋下（HTTP 429 或等效），不再觸發密碼比對。
- **FR-022**：速率限制 middleware **MUST** 以 inline `router.use(rateLimit(...))` 形式宣告於登入路由檔內（憲法 Principle IV 與 CodeQL `js/missing-rate-limiting` 規則）。
- **FR-023**：限流計數 **MUST** 以 IP 為維度；不因同帳號於其他 IP 的失敗而影響。
- **FR-023a**：限流擋下時，系統 **MUST** 以 `HTTP 429 Too Many Requests` 回應；**MUST** 於 HTTP header 夾帶 `Retry-After: <seconds>`（RFC 9110 標準，值為距離限流窗口結束的整數秒數）；**MUST** 於 JSON body 回傳 `{ message: "登入嘗試次數過多，請稍後再試", retryAfterSeconds: <number> }`。`Retry-After` header 值 **MUST** 與 body 的 `retryAfterSeconds` 完全一致。
- **FR-023b**：於 CORS 設定中，**MUST** 將 `Retry-After` 加入 `Access-Control-Expose-Headers`，讓前端 `fetch` 可讀取；同時 body 中亦提供 `retryAfterSeconds` 作為 fallback，前端 **SHOULD** 以 body 的數值為主以避免 CORS 邊緣情境。
- **FR-023c**：此 429 回應 **MUST NOT** 觸發 bcrypt 比對（FR-021 已規範）；也 **MUST NOT** 於 `LoginLog` 重複寫入 `wrong_password`；而是以 `reason = "rate_limited"` 寫入一筆紀錄。

**登入稽核紀錄**

- **FR-024**：系統 **MUST** 於每一次登入失敗（含密碼錯誤、帳號不存在、限流擋下）寫入一筆 `LoginLog`，欄位完整度為 100%。
- **FR-025**：系統 **MUST** 於每一次登入成功也寫入一筆 `LoginLog`（`success = true`），以利稽核能還原成功事件的時間 / IP / 國家。
- **FR-026**：`LoginLog` 的 `ip` **MUST** 為請求來源 IP；`country` 由 IP 查出，查不到時為空字串；兩欄皆 **MUST** 填入（不得為 `null`）。
- **FR-027**：`LoginLog.reason` 於失敗時 **MUST** 為可列舉的分類字串（如 `wrong_password`、`email_not_found`、`rate_limited`、`registration_closed`、`validation_error`、`account_disabled`）；成功時 **MAY** 為 `null` 或空字串。
- **FR-028**：系統 **MUST NOT** 於 `LoginLog` 中儲存密碼（明文或雜湊）；也 **MUST NOT** 於任何 log 輸出明文密碼。
- **FR-028a**：系統 **MUST** 將 `LoginLog` 保留期設定為 **90 天**；以 `node-cron` 每日執行一次清除任務，刪除 `createdAt < now() - 90 days` 的所有紀錄（不分 `success` 與 `reason`）。清除任務 **MUST** 隨後端服務於容器內啟動（由應用程式常駐行程持有排程，不得依賴容器外的 cron），以符合憲法 Principle V（容器化可重現部署）。
- **FR-028b**：清除任務執行時 **MUST** 以結構化 log 記錄：執行時間、刪除筆數、耗時；若清除過程失敗（例如資料庫鎖），**MUST** 以 warn 等級記錄並於下次排程重試，**MUST NOT** 使後端主流程崩潰。
- **FR-028c**：保留期設定的天數 **MAY** 於未來改為環境變數（如 `LOGINLOG_RETENTION_DAYS`）；預設仍為 `90`；任何縮短至 30 天以下的變更 **MUST** 於本規格升版並於 PR 中說明理由。
- **FR-028d**：若 `LoginLog` 寫入於執行期失敗（例如資料庫鎖、磁碟滿、SQLite 層級例外），系統 **MUST NOT** 中斷登入流程（**fail-open**）：登入成功情境下仍 **MUST** 下發 cookie；登入失敗情境下仍 **MUST** 以原本的 401 / 403 / 429 回應使用者。
- **FR-028e**：稽核寫入失敗時，系統 **MUST** 以 winston `error` 等級記錄一筆結構化 log，欄位至少包含：`event: "loginlog_write_failed"`、`email`（當次嘗試的正規化 email）、`ip`、`country`、`method: "local"`、`success`（原本要寫入 LoginLog 的布林）、`reason`（原本的失敗分類）、`error`（原始例外的 message 與 stack），以便運維自應用 log 推斷稽核遺失事件的原始內容。此結構化 log **MUST NOT** 包含密碼（明文或雜湊）。
- **FR-028f**：稽核寫入失敗屬於應用的 **known degraded mode**；監控系統（若設定）**SHOULD** 以 `event: "loginlog_write_failed"` 為告警訊號。稽核寫入失敗的重試、備援寫入檔案、或自動回填 **不屬於** 本模組 v1 範圍（屬未來版本）。

**OpenAPI 規格**

- **FR-029**：本模組所有對外 HTTP 端點 **MUST** 於 `specs/001-auth-module/contracts/` 目錄以 `openapi: 3.2.x` 規格先行定義；endpoint 實作 **MUST NOT** 先於規格合併（憲法 Principle II）。

### 2.2 關鍵實體（Key Entities）

- **User（使用者帳號）** — 代表系統中一個可登入的主體。
  - `id`：唯一識別字串。
  - `email`：登入 email（唯一，以 `trim + lowercase` 正規化後儲存；不展開 Gmail 別名——見 FR-003a；需符合 email 格式）。
  - `password`：bcrypt 雜湊字串（cost ≥ 12），明文絕不儲存。
  - `displayName`：顯示名稱（trim 後非空，必填）。
  - `role`：角色；可為 `ADMIN`、`USER`、`VIEWER`；預設 `USER`。
  - `authProvider`：認證來源；本模組處理 `LOCAL`；`GOOGLE` 由 Google SSO 模組處理（見 SRS §3.2）。
  - `theme`：主題偏好；`light` 或 `dark`；預設 `light`。
  - `isActive`：帳號啟用旗標；布林；預設 `true`。`false` 代表已被管理員停用，任何登入嘗試 **MUST** 被拒絕（FR-011a）。本模組僅 **讀取** 此欄位於登入流程中；**設定/切換** 由管理員模組（SRS §3.3）負責。
  - `passwordChangedAt`：密碼最後變更時間戳（DateTime，UTC）；預設為帳號建立時間。JWT 驗證中介層以 `jwt.iat >= passwordChangedAt` 判定憑證是否仍有效（FR-012b）；每次密碼變更於同一 transaction 更新此欄位（FR-020a）以達到「全裝置失效」效果。
  - `createdAt` / `updatedAt`：系統維護的時間戳。
  - 與 `LoginLog` 的關聯：`User` 可有多筆 `LoginLog`（一對多；`LoginLog.userId` 可為 `null` 以容納「email 不存在」情境）。

- **LoginLog（登入稽核紀錄）** — 代表一次登入嘗試的完整稽核事件。
  - `id`：唯一識別字串。
  - `userId`：關聯的 `User.id`；若使用者不存在（email 未註冊）或稽核情境為 `rate_limited` 時 **MAY** 為 `null`。
  - `email`：使用者送出的 email 原始值（trim + 小寫後）。
  - `ip`：請求來源 IP（字串，含 IPv4 / IPv6）。
  - `country`：由 `ip` 查出的 ISO 3166-1 alpha-2 國碼；查不到為空字串。
  - `method`：認證方式；本模組一律為 `"local"`。
  - `success`：布林；登入是否成功。
  - `reason`：失敗原因分類字串；成功時可為 `null`。
  - `createdAt`：事件發生時間。**保留期 90 天**（見 FR-028a），超過後由排程任務刪除。

> **本模組不擁有、僅讀取** 的實體：
> - **AdminSettings**（由管理員模組擁有）：本模組於處理註冊時讀取 `registrationOpen` 旗標，不負責寫入。

---

## 3. 成功準則（Success Criteria）*（必填）*

> 以下指標 **MUST** 為技術中立且可量測；驗收時以實際量測或自動化測試驗證，不以主觀判斷為準。

### 可量測結果

- **SC-001**：新訪客可於 **2 分鐘內** 完成「抵達註冊頁 → 完成註冊 → 登入 → 進入儀表板」整段流程（以使用者計時、非系統 RPS）。
- **SC-003**：同一來源 IP 於 1 分鐘內第 6 次登入嘗試 **MUST** 被限流擋下（以自動化測試重複 100 次，成功阻擋率 = 100%）。
- **SC-004**：在資料庫健康的正常情境下，登入失敗事件寫入 `LoginLog` 的覆蓋率 **= 100%**（以混沌式失敗情境 × 50 次樣本驗證；檢查欄位缺漏率為 0%）。於資料庫寫入故意失敗的情境下（人工斷開 DB / 填滿磁碟），登入流程 **MUST** 仍然完成（fail-open；見 FR-028d），且 winston error log 中 **MUST** 出現對應的 `event: "loginlog_write_failed"` 結構化紀錄（覆蓋率 = 100%）。
- **SC-005**：資料庫中 `User.password` 欄位 **MUST** 全數為 bcrypt 雜湊格式（以 `$2[aby]$` 開頭、長度 60 字）；以資料庫掃描工具驗證 0 筆明文。
- **SC-006**：密碼錯誤與帳號不存在的回應 **MUST** 於 HTTP 狀態碼、訊息、回應時間分佈上不可區分（以 1,000 次樣本比對兩組回應時間的 Mann-Whitney U 檢定 p > 0.05）。
- **SC-007**：`JWT_SECRET` 未設定時系統啟動 **MUST** 產生自動亂數並於 log 中留下警示字串（以啟動 log grep 驗證）；同時簽發的 token 可正常運作。
- **SC-008**：登出後，該裝置 **MUST** 立即無法以原 token 進入受保護頁面（以自動化 UI / API 測試驗證跳轉到登入頁）。
- **SC-009**：註冊、登入、密碼變更端點的 OpenAPI 3.2 規格 lint **MUST** 於 CI 上綠燈；實作的 request / response 結構 **MUST** 與規格完全一致（以 contract test 驗證）。
- **SC-010**：`LoginLog` 清除任務於生產容器內每 24 小時觸發一次（可由觀察 `node-cron` 結構化 log 驗證）；於人工插入 100 筆 `createdAt = now - 91 days` 的測試資料後，下一次排程執行 **MUST** 將該批次完全刪除（資料庫中殘留筆數 = 0）。

---

## 4. 假設（Assumptions）

- 使用者的瀏覽器支援現代 JavaScript 與第一方 cookie（`HttpOnly` + `SameSite=Strict`）；JWT 由瀏覽器自動管理，前端不直接存取。
- 前後端部署於同一可註冊網域（eTLD+1）下，使 `SameSite=Strict` cookie 能於前端頁面發出的請求被夾帶；跨網域部署屬未來版本需求，需先修訂憲法或本模組規格。
- 使用者具備穩定網路連線；本模組不處理離線情境（PWA 的離線行為由前端框架處理，不在此規格範圍）。
- 使用者對「登出僅使本地憑證失效、不維護伺服器端黑名單」此折衷可接受；高安全需求之情境（如多裝置立即撤銷、強制下線）屬未來版本。
- 管理員模組（SRS §3.3）負責維護 `AdminSettings.registrationOpen` 與提供稽核紀錄查詢介面；本模組僅讀取旗標、寫入稽核紀錄，不負責管理員 UI。
- IP → 國家的查詢由既有 `utils/ipCountry.ts` 提供；失敗時以空字串為合法值，不視為系統錯誤。
- 本模組不負責「忘記密碼 / 密碼重設 email」流程；該流程屬未來版本，需另行規格化（SRS §3.1.2 目前未涵蓋）。
- 本模組不處理多因素認證（MFA / TOTP）；屬未來版本。
- 本模組不處理 session 管理或 refresh token；JWT 單一憑證，失效即需重新登入。同一帳號的併發會話不設上限（FR-013a），異常情境靠使用者自行變更密碼處理。
- Google SSO 由獨立模組（SRS §3.2）負責；本模組僅保證 `User.authProvider = LOCAL` 的帳號能以本地密碼登入，不衝突於 Google SSO 建立的 `User.authProvider = GOOGLE` 帳號。
