-- PDF İmza İste: temel tablolar.
-- Bu tablolar şimdiye kadar yalnız `db push` ile oluşuyordu; migration geçmişinde yoktu. Sonraki migration'lar
-- (placement / deleted_at / notify_owner) onlara sütun eklediği için sıfırdan kurulan veritabanında (CI) bu adım şart.
-- IF NOT EXISTS: tabloları zaten `db push` ile oluşmuş yerel veritabanlarında da hatasız çalışır.
-- Sonradan eklenen sütunlar (placement, notify_owner, deleted_at) burada YOK; kendi migration'larıyla gelir.

-- CreateTable
CREATE TABLE IF NOT EXISTS "signature_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_data" BLOB NOT NULL,
    "original_hash" TEXT NOT NULL,
    "signed_data" BLOB,
    "signed_hash" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signer_email" TEXT NOT NULL,
    "signer_name" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "viewed_at" DATETIME,
    "signed_at" DATETIME,
    "declined_at" DATETIME,
    "decline_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signature_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "signature_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "request_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "detail" TEXT,
    "actor" TEXT,
    CONSTRAINT "signature_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "signature_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "signature_requests_token_hash_key" ON "signature_requests"("token_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "signature_requests_owner_id_created_at_idx" ON "signature_requests"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "signature_requests_signer_email_idx" ON "signature_requests"("signer_email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "signature_events_request_id_at_idx" ON "signature_events"("request_id", "at");
