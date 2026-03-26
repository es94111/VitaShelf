# VitaShelf

> 保養品與保健食品庫存管理系統
> Skincare & Health Supplement Inventory Management System

[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)]()
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
- **設定頁** — 個人資料編輯、密碼修改、CSV 資料匯出
- **行動裝置支援** — 響應式佈局，Hamburger 側邊欄，支援手機與平板操作
- **自動部署** — 推播至 GitHub 時透過 GitHub Actions 自動建置 Docker 映像並部署
- **JWT Secret 自動產生** — 開發時自動產生亂數 Secret；生產環境未設定則強制拒絕啟動

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 後端 | Node.js + Express + TypeScript |
| 資料庫 | PostgreSQL + Prisma ORM |
| 容器化 | Docker + Docker Compose |
| CI/CD | GitHub Actions → GHCR |

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
docker compose -f docker-compose.prod.yml up -d
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
│   └── Dockerfile
├── scripts/           # 工具腳本
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
| Phase 5 | v0.6.0 | 儀表板強化 + 使用者管理 | 🔲 |
| Phase 6 | v0.7.0 | 資料匯入 + 測試 | 🔲 |
| Phase 7 | v1.0.0 | 正式發佈 | 🔲 |

## 文件

- [軟體需求規格書 (SRS)](./SRS.md)
- [變更紀錄 (Changelog)](./changelog.json)

## 版本資訊

目前版本：**v0.5.0**

詳見 [changelog.json](./changelog.json) 了解完整變更歷史。

## 授權

本專案採用 [MIT License](./LICENSE) 授權。
