-- AlterTable: Invoice arşivleme (VUK Madde 253 — 10 yıllık saklama politikası)
ALTER TABLE "invoices" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN "archived_at" DATETIME;

-- CreateIndex
CREATE INDEX "invoices_is_archived_created_at_idx" ON "invoices"("is_archived", "created_at");
