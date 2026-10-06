-- CreateTable
CREATE TABLE "ai_request_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "plan_at_time" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "input_sha256" TEXT,
    "output_sha256" TEXT,
    "client_ip" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    CONSTRAINT "ai_request_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ai_request_logs_user_id_created_at_idx" ON "ai_request_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_request_logs_created_at_idx" ON "ai_request_logs"("created_at");
