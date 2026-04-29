# VitaShelf — 軟體需求規格書 (SRS)

> **版本：** 2.4.0
> **最後更新：** 2026-04-23
> **專案名稱：** VitaShelf — 保養品與保健食品庫存管理系統

---

## 1. 簡介

### 1.1 目的

本文件定義 **VitaShelf** 的功能性與非功能性需求。VitaShelf 是一套以網頁為基礎的庫存管理系統，專為個人或小型團隊管理**保養品**（Skincare）與**保健食品**（Health Supplements）而設計。

### 1.2 範圍

VitaShelf 提供以下核心能力：

- 產品資料的新增、編輯、刪除與查詢（CRUD）
- 購買紀錄與成本追蹤
- 有效期限管理與到期提醒
- 庫存數量管理（入庫 / 出庫 / 盤點）
- 分類與標籤管理
- 儀表板與數據統計
- 推播至 GitHub 時透過 GitHub Actions 自動建置 Docker 映像並部署

### 1.3 目標使用者

| 角色 | 說明 |
|------|------|
| 個人使用者 | 管理自用保養品與保健食品庫存 |
| 家庭管理者 | 為家庭成員統一管理產品 |
| 小型商家 | 管理小規模保養品或保健食品庫存 |

### 1.4 技術選型概覽

| 層級 | 技術 |
|------|------|
| 前端 | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 |
| 後端 | Node.js + Express 5 + TypeScript |
| 資料庫 | SQLite（.db 檔案，透過 Docker volume 持久化） |
| ORM | Prisma |
| 容器化 | Docker + Docker Compose |
| CI/CD | GitHub Actions → Docker Hub / GHCR |
| 通知 | Web Push / Email（可選） |

---

## 2. 系統總覽

### 2.1 系統架構圖

```
┌──────────────┐     HTTP/REST      ┌──────────────┐     Prisma     ┌──────────────┐
│   Frontend   │ ◄────────────────► │   Backend    │ ◄────────────► │   Database    │
│  React SPA   │                    │  Express API │                │ SQLite (.db)  │
└──────────────┘                    └──────────────┘                └──────────────┘
       │                                   │                                │
       └──── Nginx (Reverse Proxy) ────────┘                        Docker Volume
                      │                                          (/app/data/vitashelf.db)
               Docker Compose
```

### 2.2 部署流程

```
git push → GitHub Actions trigger
  ├─ Lint & Test
  ├─ Build Docker Image
  ├─ Push to GHCR (GitHub Container Registry)
  └─ Deploy (docker compose pull && up -d)
```

---

## 3. 功能性需求（模組規格與 User Stories）

VitaShelf 共分為 **12 個功能模組**。每個模組均包含：
- **功能描述** — 模組涵蓋的範圍與責任
- **詳細規格** — 資料欄位、API 端點、業務邏輯、驗證規則
- **User Stories** — 以 `作為 <角色>，我希望 <做什麼>，以便 <目的>` 格式描述

> **對應關係**：FR-001 ~ FR-012 對應 `backend/src/routes/` 下的 12 支 router 檔案，前端頁面位於 `frontend/src/pages/`。

---

### 3.1 認證模組 (FR-001 Auth)

#### 3.1.1 功能描述

提供本地帳號的註冊、登入、登出與 JWT 簽發、刷新機制，並負責登入失敗的稽核與限流。

#### 3.1.2 詳細規格

**資料欄位（User / LoginLog）**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `email` | `string` (unique) | ✅ | 登入帳號，格式須為 email |
| `password` | `string` (bcrypt hash) | ✅ | bcrypt cost factor ≥ 12 |
| `displayName` | `string` | ✅ | 顯示名稱 |
| `role` | `"ADMIN" \| "USER" \| "VIEWER"` | ✅ | 預設 `USER` |
| `authProvider` | `"LOCAL" \| "GOOGLE"` | ✅ | 預設 `LOCAL` |
| `theme` | `string` | ❌ | `light` / `dark`，預設 `light` |

**API 端點**

| 方法 | 路徑 | 說明 | 限流 |
|------|------|------|------|
| `POST` | `/api/auth/register` | 註冊（需 `AdminSettings.registrationOpen=true`） | write |
| `POST` | `/api/auth/login` | 登入，回傳 `{ token, user }` | login (嚴格) |
| `POST` | `/api/auth/logout` | 登出（client 端清除 token） | write |
| `GET`  | `/api/users/me` | 取得目前使用者資訊 | read |
| `PUT`  | `/api/users/me` | 更新 displayName / theme | write |
| `POST` | `/api/users/me/change-password` | 修改密碼（需提供舊密碼驗證） | write |

**業務邏輯**

- JWT payload：`{ userId, email, role }`；簽章金鑰 `JWT_SECRET`（建議 128 字元）
- JWT 有效期：7 天
- 註冊時：若 `AdminSettings.registrationOpen=false` 回 `403`
- 登入失敗一律寫入 `LoginLog`（含 `ip`、`country`、`reason`）
- 登入 rate limit：每 IP 每分鐘最多 5 次失敗（inline `router.use(rateLimit)`，通過 CodeQL 檢測）

**錯誤處理**

| 情境 | HTTP | message |
|------|------|---------|
| Email 格式錯誤 | 400 | `email 格式錯誤` |
| Email 已存在 | 409 | `帳號已存在` |
| 密碼強度不足（< 8 字） | 400 | `密碼至少需 8 字元` |
| 密碼錯誤 | 401 | `帳號或密碼錯誤` |
| 關閉公開註冊 | 403 | `目前不開放註冊` |

#### 3.1.3 User Stories

- **US-001.1** 作為新使用者，我希望能用 email + 密碼註冊帳號，以便開始管理我的庫存資料。
- **US-001.2** 作為已註冊使用者，我希望登入後取得 JWT Token，以便存取受保護的 API 與頁面。
- **US-001.3** 作為使用者，我希望登出後 token 失效，以便共用裝置時不會被他人存取我的資料。
- **US-001.4** 作為使用者，我希望能修改自己的顯示名稱與主題偏好（深/淺色），以便個人化使用體驗。
- **US-001.5** 作為使用者，我希望能提供舊密碼驗證後修改新密碼，以便定期更新密碼維持安全。
- **US-001.6** 作為安全敏感使用者，我希望連續登入失敗會被暫時限流，以便帳號不易被暴力破解。

---

### 3.2 Google SSO 模組 (FR-002 GoogleAuth)

#### 3.2.1 功能描述

整合 Google Identity Services，支援使用者以 Google 帳號一鍵登入/註冊，首次登入自動建立對應 `User`。

#### 3.2.2 詳細規格

**API 端點**

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/api/auth/google` | 接收 Google ID Token，驗證後回傳 JWT |
| `GET`  | `/api/auth/google/config` | 回傳前端需要的 `clientId`（若未啟用回 `{ enabled: false }`） |

**業務邏輯**

- 需設定環境變數 `GOOGLE_CLIENT_ID` 才啟用此模組
- 後端以 Google 公鑰驗證 ID Token 的 `aud`（需等於 `GOOGLE_CLIENT_ID`）與 `exp`
- 以 `googleId`（`sub` 欄位）作為唯一識別
  - 若 `User.googleId` 已存在 → 直接登入
  - 若 `email` 已存在但 `googleId` 為空 → 綁定該使用者並更新 `authProvider=GOOGLE`
  - 皆不符 → 建立新 `User`（`authProvider=GOOGLE`、`password` 為隨機亂數）
- 建立的新使用者受 `AdminSettings.registrationOpen` 控管

**驗證規則**

| 檢查項目 | 失敗行為 |
|----------|----------|
| ID Token 過期 | 401 `Token 已過期` |
| `aud` 不符 | 401 `Token 無效` |
| `email_verified=false` | 403 `Google 帳號未驗證 email` |

#### 3.2.3 User Stories

- **US-002.1** 作為使用者，我希望能用 Google 帳號一鍵登入，以便不必額外記帳密。
- **US-002.2** 作為已用本地帳號註冊的使用者，我希望首次用相同 email 的 Google 登入會自動綁定，以便不必維護兩個帳號。
- **US-002.3** 作為管理員，我希望能透過不設定 `GOOGLE_CLIENT_ID` 來關閉 Google SSO，以便限制登入方式。
- **US-002.4** 作為使用者，若我的 Google 帳號尚未驗證 email，我希望系統明確告知失敗原因，以便我知道該去 Google 端處理。

---

### 3.3 管理員模組 (FR-003 Admin)

#### 3.3.1 功能描述

提供 `ADMIN` 角色使用的後台：管理公開註冊開關、註冊公告、使用者角色、登入稽核紀錄。

#### 3.3.2 詳細規格

**資料欄位（AdminSettings）**

| 欄位 | 類型 | 預設 | 說明 |
|------|------|------|------|
| `id` | `string` | `"singleton"` | 固定 singleton，僅一筆 |
| `registrationOpen` | `boolean` | `true` | 是否開放公開註冊 |
| `registrationNotice` | `string` | `""` | 註冊頁顯示的公告文字（Markdown） |

**API 端點**（全部需 `role=ADMIN`）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET`   | `/api/admin/settings` | 取得 AdminSettings |
| `PATCH` | `/api/admin/settings` | 更新 `registrationOpen` / `registrationNotice` |
| `GET`   | `/api/admin/users` | 列出所有使用者（分頁） |
| `PATCH` | `/api/admin/users/:id/role` | 變更角色（`ADMIN`/`USER`/`VIEWER`） |
| `GET`   | `/api/admin/login-logs` | 取得登入稽核紀錄（預設最近 100 筆，支援 `success`、`email` 篩選） |

**業務邏輯**

- 中介層 `requireAdmin`：非 `ADMIN` 回 `403`
- 修改自己的角色需檢查至少保留一位 `ADMIN`，否則回 `400 至少須保留一位管理員`
- 登入稽核紀錄顯示：時間、email、IP、國家（由 `ipCountry.ts` 查出）、方式（local/google）、成功/失敗、失敗原因

#### 3.3.3 User Stories

- **US-003.1** 作為管理員，我希望能開關公開註冊，以便決定是否允許新帳號自助註冊。
- **US-003.2** 作為管理員，我希望能設定註冊頁公告（如「目前僅接受受邀註冊」），以便向訪客說明規則。
- **US-003.3** 作為管理員，我希望能查看所有使用者並調整其角色，以便指派管理權或降權。
- **US-003.4** 作為管理員，我希望系統防止我把最後一位管理員降權，以便不會意外失去後台存取。
- **US-003.5** 作為管理員，我希望能查看登入稽核紀錄（含 IP/國家/失敗原因），以便偵測異常存取行為。
- **US-003.6** 作為管理員，我希望設定頁集中顯示管理員子選單，以便快速進入後台功能。

---

### 3.4 產品管理模組 (FR-004 Products)

#### 3.4.1 功能描述

管理保養品與保健食品的主檔（名稱、品牌、分類、圖片、標籤等），提供 CRUD、軟刪除與還原、搜尋與分頁。

#### 3.4.2 詳細規格

**資料欄位（Product）**

| 欄位 | 類型 | 必填 | 驗證 | 說明 |
|------|------|------|------|------|
| `name` | `string` | ✅ | 1 ~ 200 字 | 產品完整名稱 |
| `brand` | `string` | ✅ | 1 ~ 100 字 | 品牌名稱 |
| `category` | `"SKINCARE" \| "SUPPLEMENT"` | ✅ | enum 字串 | 保養品 / 保健食品 |
| `subCategory` | `string?` | ❌ | ≤ 50 字 | 面膜、精華液、維他命、益生菌… |
| `spec` | `string?` | ❌ | ≤ 50 字 | 規格（50ml、60 錠、30 包） |
| `barcode` | `string?` | ❌ | ≤ 30 字 | EAN / 自訂條碼 |
| `imageUrl` | `string?` | ❌ | 由後端產生 | 圖片 URL（`/uploads/xxx`） |
| `notes` | `string?` | ❌ | ≤ 1000 字 | 備註 |
| `isDeleted` | `boolean` | ✅ | 預設 `false` | 軟刪除旗標 |
| `tags` | `Tag[]` | ❌ | M:N via `ProductTag` | 關聯標籤 |

**圖片上傳限制**

- 格式：`image/jpeg`、`image/png`、`image/webp`
- 大小：≤ 5 MB
- 儲存：`/app/uploads/{uuid}.{ext}`
- 上傳工具：`multer` + `handleUpload`

**預設分類選項（前端顯示用，不強制）**

- **SKINCARE**：洗面乳 / 化妝水 / 精華液 / 乳液 / 乳霜 / 面膜 / 防曬 / 卸妝 / 其他
- **SUPPLEMENT**：維他命 / 礦物質 / 益生菌 / 魚油 / 膠原蛋白 / 葉黃素 / 其他

**API 端點**

| 方法 | 路徑 | 說明 | Query 參數 |
|------|------|------|------------|
| `GET`    | `/api/products` | 列出產品（僅自己的） | `search`、`category`、`tag`、`page`、`pageSize`、`sortBy`、`sortDir`、`deleted` |
| `GET`    | `/api/products/:id` | 取得單一產品（含 tags / purchases / stockLogs） | — |
| `POST`   | `/api/products` | 新增產品（multipart/form-data） | — |
| `PUT`    | `/api/products/:id` | 更新產品（支援圖片替換） | — |
| `DELETE` | `/api/products/:id` | 軟刪除 | — |
| `POST`   | `/api/products/:id/restore` | 還原軟刪除 | — |

**查詢邏輯**

- `search`：對 `name`、`brand` 做 `contains`（SQLite 對 ASCII 預設不分大小寫）
- `category`：值為 `SKINCARE`/`SUPPLEMENT`（不分大小寫）
- `tag`：比對 `tags.tag.name`
- `deleted=true` 時回傳 `isDeleted=true` 的資料（已刪除清單）
- 排序欄位允許：`createdAt`（預設）、`name`、`brand`、`updatedAt`
- 預設每頁 20 筆，最大 100

**回傳結構（列表項目）**

```jsonc
{
  "id": "cuid",
  "name": "LANEIGE 水庫保濕精華",
  "brand": "LANEIGE",
  "category": "skincare",           // 小寫對外
  "tags": [{ "id": "...", "name": "保濕", "color": "#6366F1" }],
  "currentStock": 2,                // 由 StockLog 計算
  "alertLevel": "warning"           // ok / warning / urgent / expired
}
```

#### 3.4.3 User Stories

- **US-004.1** 作為使用者，我希望能新增產品並上傳產品照片，以便建立視覺化庫存主檔。
- **US-004.2** 作為使用者，我希望依名稱或品牌做模糊搜尋，以便在大量產品中快速找到目標。
- **US-004.3** 作為使用者，我希望依類別（保養品/保健食品）或標籤篩選清單，以便依場景檢視。
- **US-004.4** 作為使用者，我希望列表能依到期日或建立時間排序，以便優先處理快過期的。
- **US-004.5** 作為使用者，我希望編輯產品資訊並換圖片，以便保持資料最新。
- **US-004.6** 作為謹慎使用者，我希望刪除只是軟刪除並可從「已刪除」Tab 還原，以便不慎誤刪時能救回。
- **US-004.7** 作為使用者，我希望在產品詳情頁同時看到庫存、購買紀錄、異動歷史，以便全面了解一個產品的狀況。

---

### 3.5 標籤管理模組 (FR-005 Tags)

#### 3.5.1 功能描述

提供使用者自訂彩色標籤，支援多標籤關聯產品，並顯示每個標籤的產品計數。

#### 3.5.2 詳細規格

**資料欄位（Tag）**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `name` | `string` | ✅ | 標籤名稱，1 ~ 20 字 |
| `color` | `string` | ✅ | HEX 色碼，預設 `#64748B` |
| `userId` | `string` | ✅ | 所屬使用者 |

**唯一性**：`@@unique([name, userId])` — 同一使用者下標籤名稱不可重複

**API 端點**

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET`    | `/api/tags` | 列出標籤（含 `productCount`） |
| `POST`   | `/api/tags` | 新增標籤 |
| `PUT`    | `/api/tags/:id` | 更新名稱或顏色 |
| `DELETE` | `/api/tags/:id` | 刪除標籤（同步移除所有 `ProductTag` 關聯，產品本身不受影響） |

**驗證規則**

- `name`：trim 後 1 ~ 20 字，不可全空白
- `color`：需符合 `/^#[0-9A-Fa-f]{6}$/`
- 刪除時不需確認產品數，直接 cascade 解除關聯

#### 3.5.3 User Stories

- **US-005.1** 作為使用者，我希望自訂彩色標籤（如「旅行」「敏感肌」「補充品」），以便多維度分類產品。
- **US-005.2** 作為使用者，我希望幫同一產品掛多個標籤，以便用不同視角搜尋。
- **US-005.3** 作為使用者，我希望標籤列表顯示每個標籤有幾項產品，以便評估標籤使用狀況、清理不常用的標籤。
- **US-005.4** 作為使用者，我希望能更換標籤顏色，以便在列表中一眼區分。

---

### 3.6 購買紀錄模組 (FR-006 Purchases)

#### 3.6.1 功能描述

記錄每次購入的批次資訊（日期、數量、金額、通路）與該批次的到期相關欄位，並自動建立對應的入庫 `StockLog`。

#### 3.6.2 詳細規格

**資料欄位（PurchaseRecord）**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `productId` | `string` | ✅ | 關聯的產品（外鍵） |
| `purchaseDate` | `DateTime` | ✅ | 購買日期 |
| `quantity` | `Int` | ✅ | 本次購入數量（≥ 1） |
| `unitPrice` | `Float?` | ❌ | 單價 |
| `totalPrice` | `Float?` | ❌ | 總價（若提供 `unitPrice` 可由前端計算） |
| `channel` | `string?` | ❌ | 購買通路（官網/屈臣氏/蝦皮/iHerb…） |
| `receiptUrl` | `string?` | ❌ | 發票/收據圖片 URL |
| `manufactureDate` | `DateTime?` | ❌ | 製造日期 |
| `expiryDate` | `DateTime` | ✅ | 有效日期（必填，用於到期提醒） |
| `openedDate` | `DateTime?` | ❌ | 開封日期 |
| `paoMonths` | `Int?` | ❌ | 開封後保存月數（PAO） |
| `notes` | `string?` | ❌ | 備註 |

**API 端點**

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET`    | `/api/purchases` | 列出購買紀錄（支援 `productId` 篩選、分頁） |
| `GET`    | `/api/purchases/:id` | 取得單一紀錄 |
| `POST`   | `/api/purchases` | 新增購買紀錄 |
| `PUT`    | `/api/purchases/:id` | 更新購買紀錄 |
| `DELETE` | `/api/purchases/:id` | 刪除購買紀錄 |

**業務邏輯**

- 建立 `PurchaseRecord` 時同步建立一筆 `StockLog{ type:"IN", quantity, purchaseRecordId }`（`StockLog.purchaseRecordId` 為 `unique`，保證 1:1）
- 更新 `quantity` 時同步更新對應 `StockLog.quantity`（v2.3.6）
- 刪除 `PurchaseRecord` 時：`StockLog.purchaseRecordId` 被設為 `null`（onDelete: SetNull），但該 `StockLog` 保留作為歷史
- 開封後有效期計算：若提供 `openedDate` 與 `paoMonths`，則實際到期日 = `min(expiryDate, openedDate + paoMonths)`

**驗證規則**

| 欄位 | 規則 |
|------|------|
| `quantity` | `Int ≥ 1` |
| `unitPrice` / `totalPrice` | `≥ 0`，最多 2 位小數 |
| `expiryDate` | 需晚於 `manufactureDate`（若提供） |
| `openedDate` | 需晚於 `purchaseDate`（若提供） |
| `receiptUrl` 檔案 | 同產品圖片限制（JPG/PNG/WebP，≤ 5 MB） |

#### 3.6.3 User Stories

- **US-006.1** 作為使用者，我希望記錄每次購買的日期、數量、金額與通路，以便追蹤消費與供應來源。
- **US-006.2** 作為使用者，我希望建立購買紀錄後，系統自動新增入庫異動，以便不必手動輸入兩次。
- **US-006.3** 作為使用者，我希望填入製造日、到期日、開封日與 PAO，以便系統判斷產品真正的可用期限。
- **US-006.4** 作為使用者，我希望上傳發票照片，以便日後核帳或退貨時有憑據。
- **US-006.5** 作為使用者，我希望修改購買數量時，對應的入庫異動會自動同步，以便庫存數字永遠正確。
- **US-006.6** 作為使用者，我希望批次匯入 CSV 購買紀錄，以便從舊系統搬家時不必一筆筆手建。

---

### 3.7 庫存管理模組 (FR-007 Stock)

#### 3.7.1 功能描述

以事件流（`StockLog`）方式記錄所有庫存變化，目前庫存由所有 log 加總計算（event sourcing 風格），支援異動紀錄的編輯、刪除與全站檢視。

#### 3.7.2 詳細規格

**資料欄位（StockLog）**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `productId` | `string` | ✅ | 關聯產品 |
| `purchaseRecordId` | `string?` (unique) | ❌ | 若為入庫，連結到對應購買紀錄 |
| `type` | `"IN" \| "OUT_USE" \| "OUT_DISCARD" \| "ADJUST"` | ✅ | 異動類型 |
| `quantity` | `Int` | ✅ | 變化量（`IN`/`ADJUST` 可正，`OUT_*` 可負或以正數 + type 表示） |
| `reason` | `string?` | ❌ | 異動原因（報廢時建議必填） |

**異動類型語意**

| type | 對目前庫存的影響 | 使用情境 |
|------|------------------|----------|
| `IN` | `+quantity` | 新購入入庫（由 Purchase 自動產生） |
| `OUT_USE` | `-quantity` | 使用/開封消耗 |
| `OUT_DISCARD` | `-quantity` | 過期或損壞丟棄 |
| `ADJUST` | 以 `quantity` 覆寫差額（可正可負） | 人工盤點修正 |

**目前庫存計算**（`computeStockFromLogs`）

```
currentStock = Σ(IN) − Σ(OUT_USE) − Σ(OUT_DISCARD) + Σ(ADJUST)
```

**API 端點**

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET`    | `/api/stock/:productId` | 取得產品目前庫存與明細 |
| `POST`   | `/api/stock/adjust` | 新增一筆異動 `{ productId, type, quantity, reason }` |
| `GET`    | `/api/stock/logs` | 全站異動紀錄（v2.3.0，支援 `productId`、`type`、`from`、`to`、分頁） |
| `PUT`    | `/api/stock/logs/:id` | 編輯異動紀錄 |
| `DELETE` | `/api/stock/logs/:id` | 刪除異動紀錄 |

**業務邏輯**

- 修改/刪除 `StockLog` 後，後端立即重新計算該產品的目前庫存並回傳（v2.3.7）
- 低庫存警示門檻：`currentStock ≤ 1`（預設，未來可設為可自訂）
- 不允許使用者手動建立 `type=IN` 且 `purchaseRecordId != null` 的紀錄（避免破壞 1:1 關聯）

#### 3.7.3 User Stories

- **US-007.1** 作為使用者，我希望用「使用」「報廢」「盤點」三種方式記錄庫存變化，以便數字真實反映實際狀況。
- **US-007.2** 作為使用者，我希望在單一頁面看到全站所有庫存異動紀錄（跨產品），以便追溯歷史變動。
- **US-007.3** 作為使用者，我希望能篩選特定產品或異動類型的紀錄，以便快速定位問題。
- **US-007.4** 作為使用者，我希望修改或刪除異動紀錄後，目前庫存與已使用數立即同步，以便不用手動刷新。
- **US-007.5** 作為使用者，我希望產品列表顯示「目前庫存」徽章，以便一眼看出低庫存。
- **US-007.6** 作為使用者，我希望報廢時可填原因（如「開封後變質」），以便事後回顧。

---

### 3.8 到期提醒模組 (FR-008 Alerts)

#### 3.8.1 功能描述

依到期日與 PAO（開封後保存期）計算警示等級，提供即將到期、已過期、低庫存三類清單，並透過 Sidebar 徽章主動通知使用者。

#### 3.8.2 詳細規格

**警示等級（`getAlertLevel`）**

| 等級 | 條件 | 顏色 |
|------|------|------|
| `ok` | 到期日距今 > 30 天 | 綠 |
| `warning` | 距今 ≤ 30 天 | 黃 |
| `urgent` | 距今 ≤ 7 天 | 橘 |
| `expired` | 已過期 | 紅 |
| `openedExpired` | 開封後超過 PAO | 紅 |

**API 端點**

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/alerts/expiring` | 即將到期（`warning` + `urgent`），預設 30 天內 |
| `GET` | `/api/alerts/expired` | 已過期（含開封過期） |
| `GET` | `/api/alerts/low-stock` | 低庫存（`currentStock ≤ 1` 且 `isDeleted=false`） |
| `GET` | `/api/alerts/summary` | 三類數量總和（供 Sidebar 徽章用） |

**業務邏輯**

- 取每個產品的「最接近」到期日（`purchases.expiryDate` min）作為產品的 `nearestExpiry`
- 若有 `openedDate + paoMonths`，以 `min(expiryDate, openedDate + paoMonths)` 為實際到期日
- 已軟刪除（`isDeleted=true`）的產品一律不進入提醒清單
- 目前提醒顯示於：
  - Sidebar 徽章（數字）
  - `/alerts` 頁面（分頁：即將到期 / 已過期 / 低庫存）
  - 儀表板的「即將到期清單」卡片

**未來擴充**（非本版範圍）

- Web Push 推播（需使用者授權）
- Email 通知（需 SMTP 設定）

#### 3.8.3 User Stories

- **US-008.1** 作為使用者，我希望系統在產品 30 天內到期時黃燈警示、7 天內橘燈，已過期紅燈，以便依緊急程度處理。
- **US-008.2** 作為使用者，我希望在 Sidebar 永遠看到待處理項目的徽章數字，以便隨時掌握狀況。
- **US-008.3** 作為使用者，我希望到期提醒頁面分三個 Tab（即將到期 / 已過期 / 低庫存），以便分類檢視。
- **US-008.4** 作為使用者，我希望開封後超過 PAO 也算過期，以便不使用已變質的產品。
- **US-008.5** 作為使用者，我希望刪除產品後警示會自動消失，以便不被已處理的項目干擾。

---

### 3.9 儀表板模組 (FR-009 Dashboard)

#### 3.9.1 功能描述

提供首頁總覽，集中顯示庫存統計、消費趨勢、品牌/類別分佈、最近異動與到期提醒。

#### 3.9.2 詳細規格

**統計卡片**

| 卡片 | 資料來源 |
|------|----------|
| 產品總數 | `Product.count({ isDeleted: false })` |
| 保養品 / 保健食品數 | 依 `category` 分組計數 |
| 即將到期數 | `Alerts.summary.expiring` |
| 本月消費金額 | `PurchaseRecord.totalPrice` 依 `purchaseDate` 篩選當月總和 |

**圖表**

| 圖表 | API | 說明 |
|------|-----|------|
| 消費趨勢折線圖 | `GET /api/dashboard/monthly-spending` | 最近 12 個月的購買金額 |
| 品牌分佈 Top 10 | `GET /api/dashboard/brand-breakdown` | 依產品數降序取前 10 |
| 類別分佈長條圖 | `GET /api/dashboard/category-breakdown` | 兩大類別 × 子分類 |
| 最近異動 | `GET /api/dashboard/recent-activity` | 最近 8 筆 StockLog（含 product.name） |

**即將到期清單**

- 直接複用 `/api/alerts/expiring`，前端 limit 5 筆

#### 3.9.3 User Stories

- **US-009.1** 作為使用者，我希望進入首頁就看到庫存總覽、到期提醒與本月消費，以便一眼掌握整體狀況。
- **US-009.2** 作為使用者，我希望看到月度消費金額折線圖，以便觀察消費趨勢。
- **US-009.3** 作為使用者，我希望看到品牌分佈圓餅/長條圖，以便了解自己的消費偏好。
- **US-009.4** 作為使用者，我希望看到最近 8 筆庫存異動，以便追蹤最新的變動。
- **US-009.5** 作為使用者，我希望儀表板在行動裝置上也能良好顯示，以便手機上也能用。

---

### 3.10 資料匯入模組 (FR-010 Import)

#### 3.10.1 功能描述

提供 CSV 批次匯入產品與購買紀錄的能力，支援範本下載、逐列錯誤回報、loop bound 防護。

#### 3.10.2 詳細規格

**API 端點**

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/api/import/products` | 匯入產品（multipart CSV） |
| `POST` | `/api/import/purchases` | 匯入購買紀錄（v2.2.0） |
| `GET`  | `/api/import/products/template` | 下載產品 CSV 範本 |
| `GET`  | `/api/import/purchases/template` | 下載購買紀錄 CSV 範本 |

**CSV 格式**

- 編碼：UTF-8（可含 BOM）
- 分隔符：逗號，支援引號包裹
- 第一列為欄位標題（需與範本一致）

**產品 CSV 欄位**：`name, brand, category, subCategory, spec, barcode, notes, tags`

（`tags` 以 `|` 分隔多個標籤，找不到的標籤自動建立）

**購買紀錄 CSV 欄位**：`productName, brand, purchaseDate, quantity, unitPrice, totalPrice, channel, manufactureDate, expiryDate, openedDate, paoMonths, notes`

**回傳格式**

```json
{
  "imported": 42,
  "errors": [
    { "row": 5, "field": "expiryDate", "message": "日期格式錯誤" },
    { "row": 7, "field": "quantity", "message": "須為正整數" }
  ]
}
```

**安全限制**

- 檔案大小上限：2 MB
- 列數上限：5000 列（loop bound，commit bb38d5e，防 DoS）
- 單列欄位數上限：50
- 匯入時使用 transaction，部分失敗不會 rollback 整批（但錯誤列不寫入）

#### 3.10.3 User Stories

- **US-010.1** 作為從舊系統遷移的使用者，我希望下載 CSV 範本後批次匯入產品，以便不必手動建立數百筆資料。
- **US-010.2** 作為使用者，我希望匯入購買紀錄 CSV 時，系統能依產品名/品牌自動對應到既有產品，以便不必先建產品再匯入購買。
- **US-010.3** 作為使用者，我希望匯入失敗時能看到每列錯誤原因（第幾列、哪個欄位、什麼問題），以便逐列修正後重新匯入。
- **US-010.4** 作為安全敏感使用者，我希望匯入時有檔案大小與列數上限，以便惡意大檔案無法癱瘓系統。
- **US-010.5** 作為使用者，我希望 CSV 中的 `tags` 欄位找不到時會自動建立新標籤，以便不必事先設定所有標籤。

---

### 3.11 資料匯出模組 (FR-011 Export)

#### 3.11.1 功能描述

將產品清單與購買紀錄匯出為 CSV 檔，格式與匯入範本一致，可直接回匯入不需轉換。

#### 3.11.2 詳細規格

**API 端點**

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/export/products` | 匯出產品（CSV + UTF-8 BOM，v2.2.2 對齊範本） |
| `GET` | `/api/export/purchases` | 匯出購買紀錄（CSV + UTF-8 BOM，v2.2.4 對齊範本） |

**匯出格式**

- 編碼：UTF-8 with BOM（Excel 開啟不亂碼）
- 欄位順序與匯入範本完全一致
- 日期欄位：ISO 8601（`YYYY-MM-DD`）
- 金額欄位：保留兩位小數，不加千分位
- `tags` 欄位以 `|` 分隔

**回傳檔名**

```
vitashelf-products-2026-04-23.csv
vitashelf-purchases-2026-04-23.csv
```

**權限**

- 只能匯出自己（`userId = req.user.userId`）的資料
- 不含軟刪除產品（除非 `?includeDeleted=true`）

#### 3.11.3 User Stories

- **US-011.1** 作為使用者，我希望能一鍵匯出產品清單為 CSV，以便在 Excel 裡分析或備份。
- **US-011.2** 作為使用者，我希望匯出格式與匯入範本一致，以便匯出備份的檔案可直接重新匯入。
- **US-011.3** 作為使用者，我希望匯出檔名包含日期，以便同時保留多份快照。
- **US-011.4** 作為使用者，我希望 CSV 在 Excel 開啟時不會亂碼，以便立刻編輯使用。

---

### 3.12 更新紀錄模組 (FR-012 Changelog)

#### 3.12.1 功能描述

顯示目前版本與歷史更新日誌，支援自動版本檢查與手動檢查更新，並提供「立即更新」一鍵刷新前端快取。

#### 3.12.2 詳細規格

**資料來源**

- `changelog.json`（根目錄，由 `docker-images` 靜態掛載）
- 格式：`[{ version, date, type, changes: string[] }]`
- 前端版本：`frontend/src/data/changelog.json` + `VERSION` 檔案

**API 端點**

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/changelog` | 取得完整更新紀錄 |
| `GET` | `/api/changelog/latest` | 取得最新版本號（用於「有新版」檢查） |

**前端行為**

- 設定頁顯示目前版本（`APP_VERSION`，`VERSION` 檔案的 fallback，v2.3.1）
- 自動檢查：每次進入設定頁 + 手動觸發按鈕（v2.1.0）
- 有新版時顯示「立即更新」按鈕 → 兩步驟引導視窗 → 清除 Service Worker + 強制刷新（v2.1.2 / v2.3.4）
- Changelog 視窗化檢視（v2.3.0），不再佔整頁

**Nginx 快取設定**（v2.3.4）

- `changelog.json` 設定 `Cache-Control: no-cache` 以確保立即取得最新
- `index.html` 設定 `no-cache`，JS/CSS bundle 走長快取（檔名含 hash）

#### 3.12.3 User Stories

- **US-012.1** 作為使用者，我希望在設定頁看到目前版本號，以便確認自己的版本。
- **US-012.2** 作為使用者，我希望能查看所有歷史版本的更新內容，以便了解系統演進。
- **US-012.3** 作為使用者，我希望系統自動偵測是否有新版，以便不必手動追版本。
- **US-012.4** 作為使用者，我希望有新版時出現「立即更新」按鈕，一鍵清快取刷新，以便不必手動清瀏覽器快取。
- **US-012.5** 作為使用者，我希望更新紀錄以視窗方式顯示，以便不離開目前頁面就能查看。

---

## 3.13 模組相依關係

```
┌────────────┐
│ 1. Auth    │──┐
└────────────┘  │
┌────────────┐  │  (JWT middleware)
│ 2. Google  │──┤
└────────────┘  │
┌────────────┐  │
│ 3. Admin   │──┤
└────────────┘  │
                ▼
  ┌───────────────────────────────────┐
  │         Authenticated API          │
  └───────────────────────────────────┘
                │
┌──────────┬────┴─────┬──────────┬──────────┐
│ 4.       │ 5.       │ 6.       │ 7.       │
│ Products │ Tags     │ Purchases│ Stock    │
└──────────┴──────────┴──────────┴──────────┘
     │           │          │          │
     │           │          └──(auto)─►│ (新購入→StockLog IN)
     │           │                     │
     └────(聚合讀取)──────┬────────────┘
                         ▼
           ┌─────────────────────────┐
           │ 8. Alerts / 9. Dashboard │
           └─────────────────────────┘

  10. Import ──► 4/5/6（批次建立）
  11. Export ──► 4/6（批次讀取）
  12. Changelog（獨立、靜態資源）
```

---

## 4. 非功能性需求

### 4.1 效能 (NFR-001)

- 頁面首次載入時間 ≤ 3 秒
- API 回應時間 ≤ 500ms（p95）
- 支援至少 1,000 筆產品資料

### 4.2 安全性 (NFR-002)

- HTTPS 加密傳輸
- 密碼以 bcrypt 雜湊儲存
- API 使用 JWT 認證 + CSRF 防護
- 檔案上傳驗證（類型、大小限制）
- SQL Injection / XSS 防護

### 4.3 可用性 (NFR-003)

- 響應式設計（RWD），支援手機、平板、桌面
- 支援繁體中文介面（預設）
- 支援深色 / 淺色模式

### 4.4 可維護性 (NFR-004)

- 程式碼需有 ESLint + Prettier 規範
- 測試覆蓋率 ≥ 70%
- API 文件以 OpenAPI (Swagger) 格式維護

### 4.5 部署與維運 (NFR-005)

- Docker 容器化部署
- `docker compose up -d` 一鍵啟動
- GitHub Actions CI/CD 自動化
- 資料庫自動備份（每日）

---

## 5. CI/CD 與 Docker 部署規格

### 5.1 Docker 架構

單一 Docker Image，內含 Nginx（靜態檔案 + 反向代理）與 Node.js Express（API）：

```yaml
# docker-compose.prod.yml（概要）
services:
  vitashelf:
    image: es94111/vitashelf:latest
    ports: ["4000:4000"]        # Nginx 對外 port
    environment:
      DATABASE_URL: file:/app/data/vitashelf.db   # SQLite 檔案路徑
      JWT_SECRET: ...                              # 未設定時容器自動產生 128-char 隨機值
      API_PORT: "4001"                             # Express 內部 port
    volumes:
      - uploads_data:/app/uploads                  # 上傳檔案
      - sqlite_data:/app/data                      # SQLite 資料庫持久化

volumes:
  sqlite_data:
  uploads_data:
```

容器啟動流程：`mkdir -p /app/data` → `prisma migrate deploy`（自動建立/升級 `.db`）→ `node dist/index.js`（port 4001）→ `nginx`（port 4000）

### 5.2 GitHub Actions 工作流程

```yaml
# .github/workflows/docker-publish.yml（概要）
name: Build & Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Login to Docker Hub
        uses: docker/login-action@v3
      - name: Build & Push (Single Image)
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ secrets.DOCKERHUB_USERNAME }}/vitashelf:latest
```

### 5.3 環境變數

| 變數 | 說明 | 必填 | 範例 |
|------|------|------|------|
| `DATABASE_URL` | SQLite 檔案路徑（Prisma 格式） | ❌（容器預設 `file:/app/data/vitashelf.db`） | `file:/app/data/vitashelf.db` |
| `JWT_SECRET` | JWT 簽署密鑰（128+ 字元建議），未設定時自動產生隨機值 | 建議 | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `NODE_ENV` | 執行環境 | ❌ | `production` |
| `API_PORT` | Express 內部服務埠（Docker 內部使用，避免與 Nginx 衝突） | ❌ | `4001`（預設） |
| `CORS_ORIGIN` | 允許的 CORS 來源 | ❌ | `http://localhost` |
| `UPLOAD_DIR` | 檔案上傳目錄 | ❌ | `/app/uploads` |

---

## 6. 資料模型

### 6.1 ER 圖（簡化）

```
┌─────────────┐     1:N     ┌──────────────────┐
│   Product    │ ◄─────────► │ PurchaseRecord   │
├─────────────┤             ├──────────────────┤
│ id           │             │ id               │
│ name         │             │ productId        │
│ brand        │             │ purchaseDate     │
│ category     │             │ quantity         │
│ subCategory  │             │ unitPrice        │
│ spec         │             │ totalPrice       │
│ barcode      │             │ channel          │
│ imageUrl     │             │ receiptUrl       │
│ notes        │             │ manufactureDate  │
│ tags[]       │             │ expiryDate       │
│ isDeleted    │             │ openedDate       │
│ createdAt    │             │ paoMonths        │
│ updatedAt    │             │ notes            │
└─────────────┘             └──────────────────┘

┌─────────────┐     N:1     ┌──────────────────┐
│ StockLog     │ ◄─────────► │    Product       │
├─────────────┤             └──────────────────┘
│ id           │
│ productId    │
│ type (IN/OUT)│
│ reason       │
│ quantity     │
│ createdAt    │
└─────────────┘

┌─────────────┐
│    User      │
├─────────────┤
│ id           │
│ email        │
│ password     │
│ displayName  │
│ role         │
│ createdAt    │
└─────────────┘

┌─────────────┐
│    Tag       │
├─────────────┤
│ id           │
│ name         │
│ color        │
│ userId       │
└─────────────┘
```

---

## 7. API 端點設計（概要）

### 7.1 產品

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/products` | 取得產品列表（支援搜尋、分頁） |
| `GET` | `/api/products/:id` | 取得單一產品詳情 |
| `POST` | `/api/products` | 新增產品 |
| `PUT` | `/api/products/:id` | 更新產品 |
| `DELETE` | `/api/products/:id` | 軟刪除產品 |

### 7.2 購買紀錄

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/purchases` | 取得購買紀錄列表 |
| `POST` | `/api/purchases` | 新增購買紀錄 |
| `PUT` | `/api/purchases/:id` | 更新購買紀錄 |
| `DELETE` | `/api/purchases/:id` | 刪除購買紀錄 |

### 7.3 庫存

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/stock/:productId` | 取得產品庫存資訊 |
| `POST` | `/api/stock/adjust` | 庫存異動（入庫/出庫/盤點） |
| `GET` | `/api/stock/logs` | 取得庫存異動紀錄 |

### 7.4 到期提醒

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/alerts/expiring` | 取得即將到期產品清單 |
| `GET` | `/api/alerts/expired` | 取得已過期產品清單 |
| `GET` | `/api/alerts/low-stock` | 取得低庫存產品清單 |

### 7.5 標籤

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/tags` | 取得標籤列表（含 productCount） |
| `POST` | `/api/tags` | 新增標籤 |
| `PUT` | `/api/tags/:id` | 更新標籤（名稱/顏色） |
| `DELETE` | `/api/tags/:id` | 刪除標籤 |

### 7.6 使用者

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/api/auth/register` | 註冊 |
| `POST` | `/api/auth/login` | 登入 |
| `POST` | `/api/auth/logout` | 登出 |
| `GET` | `/api/users/me` | 取得目前使用者資訊 |
| `PUT` | `/api/users/me` | 更新顯示名稱 |
| `POST` | `/api/users/me/change-password` | 修改密碼 |

### 7.7 儀表板（擴充）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/dashboard/brand-breakdown` | 品牌分佈 Top 10（依產品數排序） |
| `GET` | `/api/dashboard/recent-activity` | 最近 8 筆庫存異動紀錄（含 product.name） |

### 7.8 匯出入

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/export/products` | 匯出產品清單（CSV，BOM） |
| `GET` | `/api/export/purchases` | 匯出購買紀錄（CSV，BOM） |
| `POST` | `/api/import/products` | 批次匯入產品（CSV multipart，回傳 imported / errors） |

---

## 8. 使用者介面概要

### 8.1 頁面清單

| 頁面 | 路徑 | 說明 | 狀態 |
|------|------|------|------|
| 登入 | `/login` | 使用者登入頁面 | ✅ |
| 註冊 | `/register` | 使用者註冊頁面 | ✅ |
| 儀表板 | `/` | 總覽儀表板（統計卡片 + Recharts 圖表） | ✅ |
| 產品列表 | `/products` | 產品搜尋 / 篩選 / 分頁 / CRUD Modal | ✅ |
| 產品詳情 | `/products/:id` | 庫存面板 / 購買紀錄表 / 編輯 / 刪除 | ✅ |
| 購買紀錄 | `/purchases` | 購買紀錄搜尋 / 篩選 / CRUD | ✅ |
| 到期提醒 | `/alerts` | 到期 / 已過期 / 低庫存提醒分頁 | ✅ |
| 分類標籤 | `/categories` | 彩色標籤 CRUD（新增/編輯/刪除 + 產品數） | ✅ |
| 設定 | `/settings` | 個人資料 / 密碼修改 / CSV 匯出 / 關於 | ✅ |

### 8.2 UI 設計原則

- 簡潔直覺，減少操作步驟
- 重要資訊（到期日、庫存量）以顏色標示
- 支援行動裝置操作
- 表單驗證即時回饋

---

## 9. 開發里程碑

| 階段 | 版本 | 內容 | 狀態 |
|------|------|------|------|
| Phase 1 | v0.1.0 | 專案初始化、SRS 文件、CI/CD 骨架、前後端完整架構 | ✅ 完成 |
| —       | v0.2.0 | JWT Secret 自動亂數產生機制 | ✅ 完成 |
| Phase 2 | v0.3.0 | 後端 API 完善 + 前端產品 CRUD 完整 UI | ✅ 完成 |
| Phase 3 | v0.4.0 | 購買紀錄 CRUD 完整前端 UI + Sidebar 到期徽章 | ✅ 完成 |
| Phase 4 | v0.5.0 | 分類標籤管理頁、設定頁（個人資料/密碼/匯出）、行動裝置響應式佈局 | ✅ 完成 |
| Phase 5 | v0.6.0 | 儀表板強化（品牌圖表 + 最近異動）、已刪除產品管理（Tab + 還原） | ✅ 完成 |
| Phase 6 | v0.7.0 | CSV 批次匯入產品（後端 parser + 設定頁 UI） | ✅ 完成 |
| Phase 7 | v1.0.0 | Error Boundary、PWA 支援（manifest + meta）、正式發佈 | ✅ 完成 |
| —       | v1.1.0 | 全面升級套件至最新版本（React 19、Router 7、Tailwind 4、Express 5） | ✅ 完成 |
| Phase 8 | v2.0.0 | 管理員模式、深色/淺色主題切換、Google SSO、登入稽核紀錄、資料庫加密 | ✅ 完成 |
| —       | v2.0.1 | 公開註冊控制修正與註冊規則一致性調整 | ✅ 完成 |
| —       | v2.0.2 | 設定頁版本資訊同步與管理員公開註冊開關可見性修正 | ✅ 完成 |
| —       | v2.1.0 | 設定頁新增自動版本檢查與手動更新檢查 | ✅ 完成 |
| —       | v2.1.1 | 修正管理員在設定頁看不到公開註冊選項 | ✅ 完成 |
| —       | v2.1.2 | 新增有新版時的「立即更新」按鈕與前端快取更新流程 | ✅ 完成 |
| —       | v2.2.0 | 新增購買紀錄 CSV 匯入功能 | ✅ 完成 |
| —       | v2.2.1 | 設定頁新增管理員子選單並集中管理員功能入口 | ✅ 完成 |
| —       | v2.2.2 | 匯出產品清單格式對齊下載產品範本 | ✅ 完成 |
| —       | v2.2.3 | 修正管理員子選單在權限驗證失敗時自動消失問題 | ✅ 完成 |
| —       | v2.2.4 | 匯出購買紀錄格式對齊下載購買紀錄範本 | ✅ 完成 |
| —       | v2.3.0 | 新增全站庫存異動紀錄頁、資料管理移至管理員頁、版本紀錄視窗化 | ✅ 完成 |
| —       | v2.3.1 | 修正設定頁版本資訊無法顯示，新增 APP_VERSION fallback 機制 | ✅ 完成 |
| —       | v2.3.7 | 修正刪除/編輯庫存異動紀錄後目前庫存與已使用數量未即時更新 | ✅ 完成 |
| —       | v2.3.6 | 修正庫存異動紀錄頁無法載入（路由衝突），購買紀錄修改自動同步入庫紀錄 | ✅ 完成 |
| —       | v2.3.5 | 修正版本紀錄視窗 v2.3.3、v2.3.4 顯示空白（changelog 欄位格式錯誤） | ✅ 完成 |
| —       | v2.4.0 | 資料庫由 PostgreSQL 改為 SQLite（.db 檔案），SRS 擴充為 12 模組完整規格 + User Stories | ✅ 完成 |
| —       | v2.3.4 | 修正「立即更新」按鈕無效問題，改為兩步驟引導視窗並修正 nginx 快取設定 | ✅ 完成 |
| —       | v2.3.3 | 新增網站 favicon（SVG 圓角方形葉片圖示）與 PWA apple-touch-icon | ✅ 完成 |
| —       | v2.3.2 | 修正 changelog.json 格式錯誤，版本資訊改為 bundle 載入 | ✅ 完成 |
| —       | v1.2.1 | 修復 Docker 部署後資料庫表格不存在 — 補建 Prisma 初始 migration | ✅ 完成 |
| —       | v1.2.0 | 新增註冊頁面、修復 Docker 部署問題（Nginx/Port/Prisma/環境變數） | ✅ 完成 |

---

## 10. 附錄

### 10.1 名詞定義

| 名詞 | 說明 |
|------|------|
| PAO | Period After Opening，開封後保存期限 |
| CRUD | Create, Read, Update, Delete |
| GHCR | GitHub Container Registry |
| RWD | Responsive Web Design |
| SPA | Single Page Application |

### 10.2 參考資料

- [Docker Compose 文件](https://docs.docker.com/compose/)
- [GitHub Actions 文件](https://docs.github.com/en/actions)
- [Prisma ORM 文件](https://www.prisma.io/docs)
- [React 文件](https://react.dev/)
