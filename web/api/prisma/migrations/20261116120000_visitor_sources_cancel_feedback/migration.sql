-- Ziyaretçinin geldiği yer (reklam/paylaşım bağlantısı etiketleri) + abonelik iptali nedenleri.
ALTER TABLE "PageView" ADD COLUMN "utm_source" TEXT;
ALTER TABLE "PageView" ADD COLUMN "utm_medium" TEXT;
ALTER TABLE "PageView" ADD COLUMN "utm_campaign" TEXT;
CREATE INDEX "PageView_sessionId_idx" ON "PageView"("sessionId");

CREATE TABLE "cancellation_feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "action" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "cancellation_feedback_created_at_idx" ON "cancellation_feedback"("created_at");
CREATE INDEX "cancellation_feedback_user_id_idx" ON "cancellation_feedback"("user_id");
