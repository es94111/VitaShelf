# VitaShelf

> 保養品與保健食品庫存管理系統
> Skincare & Health Supplement Inventory Management System

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)]()

---

## 簡介

**VitaShelf** 是一套以網頁為基礎的庫存管理系統，專為管理保養品與保健食品而設計。透過直覺化的介面，輕鬆記錄產品資訊、購買紀錄、有效日期，並在產品即將到期時主動提醒。

## 功能特色

- **產品管理** — 新增、編輯、搜尋保養品與保健食品
- **購買紀錄** — 追蹤每次購入的日期、數量、價格與通路
- **有效期限管理** — 紀錄製造日期、到期日、開封日與 PAO（開封後保存期限）
- **到期提醒** — 黃色（30天前）、橘色（7天前）、紅色（已過期）分級警示
- **庫存管理** — 入庫 / 出庫 / 報廢 / 盤點，即時掌握庫存狀態
- **儀表板** — 庫存總覽、消費統計、品牌分佈等圖表
- **資料匯出入** — 支援 CSV / Excel 匯出入
- **自動部署** — 推播至 GitHub 時透過 GitHub Actions 自動建置 Docker 映像並部署
- **JWT Secret 自動產生** — 開發時自動產生亂數 Secret；生產環境未設定則強制拒絕啟動

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 後端 | Node.js + Express |
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

# 啟動開發環境
docker compose up -d

# 前端開發
cd frontend && npm install && npm run dev

# 後端開發
cd backend && npm install && npm run dev
```

### Docker 部署

```bash
docker compose -f docker-compose.prod.yml up -d
```

## 專案結構

```
VitaShelf/
├── frontend/          # React 前端應用
├── backend/           # Express 後端 API
├── docker-compose.yml # Docker 開發環境
├── .github/
│   └── workflows/     # GitHub Actions CI/CD
├── SRS.md             # 軟體需求規格書
├── changelog.json     # 變更紀錄
└── README.md
```

## 文件

- [軟體需求規格書 (SRS)](./SRS.md)
- [變更紀錄 (Changelog)](./changelog.json)

## 版本資訊

目前版本：**v0.1.0**

詳見 [changelog.json](./changelog.json) 了解完整變更歷史。

## 授權

本專案採用 [MIT License](./LICENSE) 授權。
