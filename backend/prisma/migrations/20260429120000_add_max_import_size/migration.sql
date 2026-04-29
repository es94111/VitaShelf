-- AlterTable: AdminSettings 加上 maxImportSizeMb 欄位（完整備份匯入大小上限，MB）
ALTER TABLE "AdminSettings" ADD COLUMN "maxImportSizeMb" INTEGER NOT NULL DEFAULT 200;
