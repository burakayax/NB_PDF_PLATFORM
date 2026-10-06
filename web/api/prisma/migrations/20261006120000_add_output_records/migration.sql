-- CreateTable
CREATE TABLE "output_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "tool_id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "file_sha256" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "plan_at_time" TEXT,
    "produced_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "output_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "output_records_file_sha256_idx" ON "output_records"("file_sha256");

-- CreateIndex
CREATE INDEX "output_records_user_id_created_at_idx" ON "output_records"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "output_records_user_id_result_id_key" ON "output_records"("user_id", "result_id");
