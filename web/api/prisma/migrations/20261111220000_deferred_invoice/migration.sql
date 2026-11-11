-- AlterTable
ALTER TABLE "PaymentCheckout" ADD COLUMN "invoice_due_at" TIMESTAMP(3);
ALTER TABLE "PaymentCheckout" ADD COLUMN "invoice_action" TEXT;
ALTER TABLE "PaymentCheckout" ADD COLUMN "invoice_review_notified_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PaymentCheckout_invoice_status_invoice_due_at_idx" ON "PaymentCheckout"("invoice_status", "invoice_due_at");
