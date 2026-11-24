-- Sunucu araç çağrısı kaydı (kim, hangi araç, sonuç, süre, boyut). Kişisel içerik yok. IF NOT EXISTS: db push ile kurulmuş veritabanında tablo olabilir.
CREATE TABLE IF NOT EXISTS "tool_call_logs" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tool" TEXT NOT NULL,
    "user_id" TEXT,
    "guest" BOOLEAN NOT NULL DEFAULT false,
    "status" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "reason" TEXT,
    "duration_ms" INTEGER,
    "size_kb" INTEGER,
    CONSTRAINT "tool_call_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "tool_call_logs_at_idx" ON "tool_call_logs"("at");
CREATE INDEX IF NOT EXISTS "tool_call_logs_tool_at_idx" ON "tool_call_logs"("tool", "at");
CREATE INDEX IF NOT EXISTS "tool_call_logs_user_id_at_idx" ON "tool_call_logs"("user_id", "at");
