-- Araç puanları — arama sonuçlarındaki yıldızların (aggregateRating) dayanağı.
-- Ham IP saklanmaz; voter_hash = IP + tarayıcı imzasının karması. Tekil kısıt,
-- aynı kişinin aynı aracı ikinci kez saymasını engeller (oyu günceller).
CREATE TABLE "tool_ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tool_slug" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "comment" TEXT,
    "voter_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "tool_ratings_tool_slug_voter_hash_key" ON "tool_ratings"("tool_slug", "voter_hash");
CREATE INDEX "tool_ratings_tool_slug_idx" ON "tool_ratings"("tool_slug");
