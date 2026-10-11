-- Araç tanıtım videosu (Reels): yalnız üretim ile paylaşım arasında tutulur.
CREATE TABLE "social_tool_videos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tool_id" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "social_tool_videos_tool_id_created_at_idx" ON "social_tool_videos"("tool_id", "created_at");
