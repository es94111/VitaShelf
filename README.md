# VitaShelf

> 保養品與保健食品庫存管理系統
> Skincare & Health Supplement Inventory Management System

[![Version](https://img.shields.io/badge/version-1.2.1-blue.svg)]()
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

## 文件

- [軟體需求規格書 (SRS)](./SRS.md)
- [變更紀錄 (Changelog)](./changelog.json)

## 版本資訊

目前版本：**v1.2.0**

詳見 [changelog.json](./changelog.json) 了解完整變更歷史。

## 授權

本專案採用 [MIT License](./LICENSE) 授權。
