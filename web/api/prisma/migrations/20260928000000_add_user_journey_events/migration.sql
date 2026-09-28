-- CreateTable
CREATE TABLE "user_journey_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tool_id" TEXT,
    "extra" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    CONSTRAINT "user_journey_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "user_journey_events_session_id_idx" ON "user_journey_events"("session_id");

-- CreateIndex
CREATE INDEX "user_journey_events_user_id_idx" ON "user_journey_events"("user_id");

-- CreateIndex
CREATE INDEX "user_journey_events_created_at_idx" ON "user_journey_events"("created_at");

-- CreateIndex
CREATE INDEX "user_journey_events_name_idx" ON "user_journey_events"("name");
