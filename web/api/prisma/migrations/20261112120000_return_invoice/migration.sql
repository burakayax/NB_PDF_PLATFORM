-- Kurumsal alıcıya iyi niyet iadesi: müşterinin keseceği iade faturası takibi (invoices tablosu).
ALTER TABLE "invoices" ADD COLUMN "return_status" TEXT;
ALTER TABLE "invoices" ADD COLUMN "return_requested_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "return_reason" TEXT;
ALTER TABLE "invoices" ADD COLUMN "return_force" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN "return_invoice_uuid" TEXT;
ALTER TABLE "invoices" ADD COLUMN "return_invoice_no" TEXT;
ALTER TABLE "invoices" ADD COLUMN "return_kdv_amount" TEXT;
ALTER TABLE "invoices" ADD COLUMN "return_received_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "return_reminder_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "return_last_checked_at" TIMESTAMP(3);
CREATE INDEX "invoices_return_status_idx" ON "invoices"("return_status");
