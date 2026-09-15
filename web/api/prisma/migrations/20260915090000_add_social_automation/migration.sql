-- Sosyal medya otomasyonu: bağlı hesaplar ve paylaşım kuyruğu.
-- Enum alanları (platform, status) Prisma tarafından metin olarak saklanır.

CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    -- AES-256-GCM ile şifreli JSON; düz metin anahtar asla yazılmaz.
    "secrets_json" TEXT NOT NULL,
    "token_expires_at" DATETIME,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_checked_at" DATETIME,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "social_accounts_platform_key" ON "social_accounts"("platform");

CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "day_key" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'tr',
    "title" TEXT NOT NULL,
    "link_url" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "scheduled_at" DATETIME NOT NULL,
    "published_at" DATETIME,
    "external_id" TEXT,
    "external_url" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- Aynı yazı, aynı ağda, aynı gün ikinci kez kuyruğa giremez.
CREATE UNIQUE INDEX "social_posts_platform_guid_day_key_key" ON "social_posts"("platform", "guid", "day_key");
CREATE INDEX "social_posts_status_scheduled_at_idx" ON "social_posts"("status", "scheduled_at");
CREATE INDEX "social_posts_created_at_idx" ON "social_posts"("created_at");
