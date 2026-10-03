-- CreateTable
CREATE TABLE "contract_review_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "charge_source" TEXT NOT NULL,
    "chars" INTEGER NOT NULL,
    "doc_sha256" TEXT NOT NULL,
    "consent_version" TEXT NOT NULL,
    "consent_at" DATETIME NOT NULL,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "fail_reason" TEXT,
    "refunded_at" DATETIME,
    "report_sha256" TEXT,
    "report_signature" TEXT,
    "finished_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contract_review_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "contract_review_logs_user_id_created_at_idx" ON "contract_review_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "contract_review_logs_status_created_at_idx" ON "contract_review_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "contract_review_logs_created_at_idx" ON "contract_review_logs"("created_at");
