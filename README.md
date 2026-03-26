# VitaShelf

> 保養品與保健食品庫存管理系統
> Skincare & Health Supplement Inventory Management System

[![Version](https://img.shields.io/badge/version-2.2.4-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)]()

---

## 簡介

**VitaShelf** 是一套以網頁為基礎的庫存管理系統，專為管理保養品與保健食品而設計。透過直覺化的介面，輕鬆記錄產品資訊、購買紀錄、有效日期，並在產品即將到期時主動提醒。

## 功能特色

- **產品管理** — 新增、編輯、搜尋保養品與保健食品，支援圖片上傳、標籤多選
- **購買紀錄** — 追蹤每次購入的日期、數量、價格與通路，自動計算總價
- **有效期限管理** — 紀錄製造日期、到期日、開封日與 PAO（開封後保存期限）
- **到期提醒** — 黃色（30天前）、橘色（7天前）、紅色（已過期）分級警示
- **庫存管理** — 入庫 / 出庫 / 報廢 / 盤點，即時掌握庫存狀態
- **分類標籤** — 自訂彩色標籤管理，支援新增、編輯、刪除
- **儀表板** — 庫存總覽、消費統計、品牌分佈等圖表
- **設定頁** — 個人資料編輯、密碼修改、CSV 資料匯出 / 批次匯入
- **行動裝置支援** — 響應式佈局，Hamburger 側邊欄，支援手機與平板操作
- **PWA 支援** — 可加入主畫面（Add to Home Screen），支援 standalone 模式
- **錯誤邊界** — React Error Boundary 攔截渲染錯誤，顯示友善錯誤畫面
- **自動部署** — 推播至 GitHub 時透過 GitHub Actions 自動建置 Docker 映像並部署
- **JWT Secret 自動產生** — 開發時自動產生亂數 Secret；生產環境未設定則強制拒絕啟動
- **深色/淺色主題切換** — 本機先行生效，後端同步異常時不影響當下使用
- **管理員模式** — 第一位使用者自動成為管理員，可控管註冊政策與使用者帳號
- **登入稽核紀錄** — 記錄登入時間、IP、IP 國家（ipinfo.io）、登入方式，管理員可查看全站紀錄
- **登入紀錄管理** — 支援單筆刪除、批次勾選刪除、手動同步、分頁瀏覽
- **Google SSO** — 一鍵 Google 帳號登入（設定 GOOGLE_CLIENT_ID 即啟用）
- **資料庫加密** — ChaCha20-Poly1305 + PBKDF2-SHA256 應用層加密（設定 DB_ENCRYPTION_KEY 即啟用）
- **版本更新檢查** — 設定頁自動檢查是否有新版本，並可手動立即檢查
- **網頁內更新按鈕** — 發現新版本時可直接在設定頁按「立即更新」套用最新版本
- **購買紀錄匯入** — 設定頁支援 CSV 批次匯入購買紀錄
- **管理員子選單** — 設定頁集中管理管理員權限功能與入口

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 |
| 後端 | Node.js + Express 5 + TypeScript |
| 資料庫 | PostgreSQL + Prisma ORM |
| 容器化 | Docker（單一 Image：Nginx + Node.js） + Docker Compose |
| CI/CD | GitHub Actions → Docker Hub / GHCR |

## 快速開始

### 前置需求

- [Node.js](https://nodejs.org/) ≥ 20
- [Docker](https://www.docker.com/) + Docker Compose
- [Git](https://git-scm.com/)

### 本地開發

```bash
# 複製專案
git clone https://github.com/<your-username>/VitaShelf.git
cd VitaShelf

# 產生 .env 並自動填入隨機 JWT_SECRET（首次必做）
npm run setup:env

# 啟動開發環境（PostgreSQL）
docker compose up -d

# 後端
cd backend && npm install && npm run dev

# 前端（另開終端）
cd frontend && npm install && npm run dev
```

### Docker 部署

```bash
# 從 Docker Hub 拉取並啟動（需設定 .env）
docker compose -f docker-compose.prod.yml up -d

# 或本機建置後啟動
docker build -t vitashelf:local .
docker compose -f docker-compose.local-images.yml up -d
```

## 環境變數說明

複製 `.env.example` 為 `.env` 並依需求填入：

```bash
cp .env.example .env
```

### 必填

| 變數 | 說明 | 範例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 連線字串 | `postgresql://user:pass@db:5432/vitashelf` |
| `JWT_SECRET` | JWT 簽章金鑰（建議 64 字元以上亂數）| `openssl rand -hex 32` |
| `POSTGRES_USER` | PostgreSQL 使用者名稱 | `vitashelf` |
| `POSTGRES_PASSWORD` | PostgreSQL 密碼 | `your_password` |
| `POSTGRES_DB` | PostgreSQL 資料庫名稱 | `vitashelf` |

> **注意**：生產環境未設定 `JWT_SECRET` 時，容器將拒絕啟動。

### 選填

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `NODE_ENV` | 執行環境 | `production` |
| `PORT` | API 監聽埠 | `4000` |
| `CORS_ORIGIN` | 允許跨域來源 | `http://localhost` |
| `UPLOAD_DIR` | 圖片上傳目錄 | `/app/uploads` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID，設定後啟用 Google SSO | 停用 |
| `DB_ENCRYPTION_KEY` | 資料庫加密金鑰（ChaCha20-Poly1305 + PBKDF2-SHA256），設定後啟用應用層加密 | 停用 |
| `GITHUB_REPOSITORY` | Docker 映像來源（Docker Compose prod 使用）| — |
| `IMAGE_TAG` | Docker 映像標籤 | `latest` |

### Google SSO 設定步驟

1. 前往 [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. 建立 **OAuth 2.0 用戶端 ID**，類型選「網頁應用程式」
3. 在授權的 JavaScript 來源填入你的網域（如 `https://your-domain.com`）
4. 將產生的 Client ID 填入 `GOOGLE_CLIENT_ID`

### 資料庫加密說明

設定 `DB_ENCRYPTION_KEY` 後，系統會自動以 ChaCha20-Poly1305 加密敏感欄位。**金鑰一旦設定不可更改**，否則現有加密資料將無法解密。建議使用 `openssl rand -hex 32` 產生。

## 已實作頁面

| 路徑 | 頁面 | 狀態 |
|------|------|------|
| `/` | 儀表板（統計卡片 + Recharts 圖表） | ✅ |
| `/products` | 產品列表（搜尋/篩選/分頁/CRUD） | ✅ |
| `/products/:id` | 產品詳情（庫存面板/購買紀錄/編輯/刪除） | ✅ |
| `/purchases` | 購買紀錄（搜尋/篩選/CRUD） | ✅ |
| `/alerts` | 到期提醒（即將到期/已過期/低庫存） | ✅ |
| `/categories` | 分類標籤管理（色彩標籤 CRUD） | ✅ |
| `/settings` | 設定（個人資料/密碼/匯出） | ✅ |
| `/login` | 登入 | ✅ |
| `/register` | 註冊 | ✅ |

## 專案結構

```
VitaShelf/
├── frontend/          # React 前端應用
│   ├── src/
│   │   ├── components/   # 共用 UI 元件
│   │   ├── pages/        # 頁面元件
│   │   ├── hooks/        # 自訂 Hooks
│   │   └── services/     # API 服務層
│   └── Dockerfile
├── backend/           # Express 後端 API
│   ├── src/
│   │   ├── routes/       # API 路由
│   │   ├── middleware/   # 中間件
│   │   └── utils/        # 工具函式
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── package.json
├── scripts/           # 工具腳本
├── Dockerfile         # 單一 Docker Image（Nginx + Node.js）
├── nginx.conf         # Nginx 反向代理設定
├── docker-entrypoint.sh # 容器啟動腳本（migration + API + Nginx）
├── docker-compose.yml # Docker 開發環境
├── docker-compose.prod.yml
├── .github/
│   └── workflows/     # GitHub Actions CI/CD
├── SRS.md             # 軟體需求規格書
├── changelog.json     # 變更紀錄
└── README.md
```

## 開發進度

| 階段 | 版本 | 說明 | 狀態 |
|------|------|------|------|
| Phase 1 | v0.1.0 | 專案初始化、SRS、CI/CD 骨架、前後端完整架構 | ✅ |
| —       | v0.2.0 | JWT Secret 自動亂數產生機制 | ✅ |
| Phase 2 | v0.3.0 | 後端 API 完善 + 前端產品 CRUD 完整 UI | ✅ |
| Phase 3 | v0.4.0 | 購買紀錄 CRUD 完整前端 UI | ✅ |
| Phase 4 | v0.5.0 | 分類標籤管理、設定頁、行動裝置響應式佈局 | ✅ |
| Phase 5 | v0.6.0 | 儀表板強化（品牌圖表 + 最近異動）、已刪除產品管理 | ✅ |
| Phase 6 | v0.7.0 | CSV 批次匯入產品（後端 parser + 設定頁 UI） | ✅ |
| Phase 7 | v1.0.0 | Error Boundary、PWA 支援（manifest + meta）、正式發佈 | ✅ |
| —       | v1.1.0 | 全面升級套件（React 19、Router 7、Tailwind 4、Express 5、Recharts 3） | ✅ |
| —       | v1.2.0 | 新增註冊頁面、修復 Docker 部署問題（Nginx/Port/Prisma/環境變數） | ✅ |
| Phase 8 | v2.0.0 | 管理員模式、深色/淺色主題、Google SSO、登入稽核紀錄、資料庫加密 | ✅ |
| —       | v2.0.1 | 公開註冊控制修正與註冊規則一致性調整 | ✅ |
| —       | v2.0.2 | 設定頁版本資訊同步與管理員公開註冊開關可見性修正 | ✅ |
| —       | v2.1.0 | 設定頁新增自動版本檢查與手動更新檢查 | ✅ |
| —       | v2.1.1 | 修正管理員在設定頁看不到公開註冊選項 | ✅ |
| —       | v2.1.2 | 新增有新版時的「立即更新」按鈕與前端快取更新流程 | ✅ |
| —       | v2.2.0 | 新增購買紀錄 CSV 匯入功能 | ✅ |
| —       | v2.2.1 | 設定頁新增管理員子選單並集中管理員功能入口 | ✅ |
| —       | v2.2.2 | 匯出產品清單格式對齊下載產品範本 | ✅ |
| —       | v2.2.3 | 修正管理員子選單在權限驗證失敗時自動消失問題 | ✅ |
| —       | v2.2.4 | 匯出購買紀錄格式對齊下載購買紀錄範本 | ✅ |

## 文件

- [軟體需求規格書 (SRS)](./SRS.md)
- [變更紀錄 (Changelog)](./changelog.json)

## 版本資訊

目前版本：**v2.2.4**

詳見 [changelog.json](./changelog.json) 了解完整變更歷史。

## 授權

本專案採用 [MIT License](./LICENSE) 授權。
