-- Sosyal medya: yazı başına bir kez araştırılan anahtar kelimelerin önbelleği.
CREATE TABLE "social_keyword_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guid" TEXT NOT NULL,
    "tr_json" TEXT NOT NULL,
    "en_json" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'seo',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "social_keyword_cache_guid_key" ON "social_keyword_cache"("guid");
