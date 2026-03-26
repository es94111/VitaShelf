# VitaShelf — 軟體需求規格書 (SRS)

> **版本：** 2.1.1
> **最後更新：** 2026-03-26
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
| 資料庫 | SQLite（開發）/ PostgreSQL（生產） |
| ORM | Prisma |
| 容器化 | Docker + Docker Compose |
| CI/CD | GitHub Actions → Docker Hub / GHCR |
| 通知 | Web Push / Email（可選） |

---

## 2. 系統總覽

### 2.1 系統架構圖

```
┌──────────────┐     HTTP/REST      ┌──────────────┐     Prisma     ┌────────────┐
│   Frontend   │ ◄────────────────► │   Backend    │ ◄────────────► │  Database   │
│  React SPA   │                    │  Express API │                │ PostgreSQL  │
└──────────────┘                    └──────────────┘                └────────────┘
       │                                   │
       └──── Nginx (Reverse Proxy) ────────┘
                      │
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

## 3. 功能性需求

### 3.1 產品管理 (FR-001)

#### 3.1.1 新增產品

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| 產品名稱 | `string` | ✅ | 產品完整名稱 |
| 品牌 | `string` | ✅ | 品牌名稱 |
| 類別 | `enum` | ✅ | 保養品 / 保健食品 |
| 子分類 | `string` | ❌ | 如：面膜、精華液、維他命、益生菌等 |
| 規格 | `string` | ❌ | 如：50ml、60錠、30包 |
| 條碼/EAN | `string` | ❌ | 產品條碼，可掃碼輸入 |
| 產品圖片 | `file` | ❌ | 支援 JPG/PNG，最大 5MB |
| 備註 | `text` | ❌ | 自由文字欄位 |
| 標籤 | `string[]` | ❌ | 自定義標籤（如：日常、旅行用） |

#### 3.1.2 編輯產品

- 可編輯所有欄位
- 編輯歷史留存（audit log）

#### 3.1.3 刪除產品

- 軟刪除（標記為已刪除，不從資料庫移除）
- 可從「已刪除」清單中還原

#### 3.1.4 查詢與搜尋

- 依名稱、品牌、類別、標籤搜尋
- 支援模糊搜尋
- 排序：名稱、到期日、購入日期、庫存數量
- 分頁顯示（預設每頁 20 筆）

---

### 3.2 購買紀錄 (FR-002)

每次購入一批產品時，建立一筆購買紀錄：

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| 關聯產品 | `ref` | ✅ | 連結至產品 |
| 購買日期 | `date` | ✅ | 購買日期 |
| 購買數量 | `integer` | ✅ | 本次購入數量 |
| 單價 | `decimal` | ❌ | 每個/每瓶單價 |
| 總價 | `decimal` | ❌ | 本次購買總金額 |
| 購買通路 | `string` | ❌ | 如：官網、屈臣氏、蝦皮、iHerb |
| 發票/收據 | `file` | ❌ | 上傳發票照片 |
| 備註 | `text` | ❌ | 自由文字 |

---

### 3.3 有效期限管理 (FR-003)

#### 3.3.1 到期日紀錄

每筆購買紀錄可設定：

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| 製造日期 | `date` | ❌ | 產品製造日期 |
| 有效日期 | `date` | ✅ | 產品到期日 |
| 開封日期 | `date` | ❌ | 開封使用日期 |
| 開封後有效期 | `integer` | ❌ | 開封後幾個月內需用完（PAO） |

#### 3.3.2 到期提醒

| 提醒規則 | 說明 |
|----------|------|
| 即將到期（黃色） | 到期日前 30 天 |
| 緊急到期（橘色） | 到期日前 7 天 |
| 已過期（紅色） | 超過有效日期 |
| 開封過期（紅色） | 超過開封後有效期 |

提醒方式：
- 儀表板醒目提示
- 瀏覽器推播通知（Web Push，需使用者授權）
- Email 通知（可選，未來版本）

---

### 3.4 庫存管理 (FR-004)

#### 3.4.1 庫存異動

| 操作 | 說明 |
|------|------|
| 入庫 | 購買入庫，自動增加庫存 |
| 出庫（使用） | 標記為已使用 / 已開封，扣減庫存 |
| 出庫（報廢） | 過期或損壞，扣減庫存並記錄原因 |
| 盤點 | 手動調整庫存數量 |

#### 3.4.2 庫存狀態

- 總庫存量
- 未開封數量
- 已開封數量
- 已報廢數量
- 低庫存警示（自訂閾值，預設：≤ 1）

---

### 3.5 分類與標籤管理 (FR-005)

#### 3.5.1 預設分類

**保養品：**
- 洗面乳 / 化妝水 / 精華液 / 乳液 / 乳霜 / 面膜 / 防曬 / 卸妝 / 其他

**保健食品：**
- 維他命 / 礦物質 / 益生菌 / 魚油 / 膠原蛋白 / 葉黃素 / 其他

#### 3.5.2 自定義標籤

- 使用者可自行建立、編輯、刪除標籤
- 標籤以顏色區分
- 一個產品可有多個標籤

---

### 3.6 儀表板與統計 (FR-006)

| 統計項目 | 說明 |
|----------|------|
| 庫存總覽 | 各類別產品數量的總覽卡片 |
| 即將到期清單 | 依到期日排序的警示清單 |
| 消費統計 | 月度/年度購買金額圖表 |
| 品牌分佈 | 各品牌產品數量圓餅圖 |
| 類別分佈 | 各類別庫存數量長條圖 |
| 最近異動 | 最近 10 筆庫存異動紀錄 |

---

### 3.7 使用者管理 (FR-007)

#### 3.7.1 帳號功能

- 註冊 / 登入 / 登出
- 密碼重設
- JWT Token 認證

#### 3.7.2 權限（未來版本）

- 管理員：完整權限
- 一般使用者：僅能操作自己的資料
- 唯讀使用者：僅能查看

---

### 3.8 資料匯出入 (FR-008)

| 功能 | 格式 |
|------|------|
| 匯出產品清單 | CSV / Excel (.xlsx) |
| 匯出購買紀錄 | CSV / Excel (.xlsx) |
| 匯入產品資料 | CSV（提供範本下載） |

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
      DATABASE_URL: postgresql://...
      JWT_SECRET: ...           # 未設定時容器自動產生 128-char 隨機值
      API_PORT: "4001"          # Express 內部 port（避免與 Nginx 衝突）
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
```

容器啟動流程：`prisma migrate deploy` → `node dist/index.js`（port 4001）→ `nginx`（port 4000）

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
| `DATABASE_URL` | 資料庫連線字串 | ✅ | `postgresql://user:pass@db:5432/vitashelf` |
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
