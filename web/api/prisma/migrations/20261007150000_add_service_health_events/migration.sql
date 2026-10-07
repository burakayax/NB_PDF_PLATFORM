-- CreateTable
CREATE TABLE "service_health_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "component" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "latency_ms" INTEGER,
    "path" TEXT,
    "status" INTEGER,
    "detail" TEXT
);

-- CreateIndex
CREATE INDEX "service_health_events_component_at_idx" ON "service_health_events"("component", "at");

-- CreateIndex
CREATE INDEX "service_health_events_at_idx" ON "service_health_events"("at");
