-- CreateTable
CREATE TABLE "financial_record_archives" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "original_user_id" TEXT NOT NULL,
    "email_snapshot" TEXT NOT NULL,
    "name_snapshot" TEXT,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "retain_until" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "financial_record_archives_email_snapshot_idx" ON "financial_record_archives"("email_snapshot");

-- CreateIndex
CREATE INDEX "financial_record_archives_retain_until_idx" ON "financial_record_archives"("retain_until");
