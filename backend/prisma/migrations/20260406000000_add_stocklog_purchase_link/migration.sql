-- AlterTable: add purchaseRecordId to StockLog
ALTER TABLE "StockLog" ADD COLUMN "purchaseRecordId" TEXT;

-- CreateIndex: unique so each PurchaseRecord links to at most one StockLog
CREATE UNIQUE INDEX "StockLog_purchaseRecordId_key" ON "StockLog"("purchaseRecordId");

-- AddForeignKey
ALTER TABLE "StockLog" ADD CONSTRAINT "StockLog_purchaseRecordId_fkey"
  FOREIGN KEY ("purchaseRecordId") REFERENCES "PurchaseRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
