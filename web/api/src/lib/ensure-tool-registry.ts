import { prisma } from "./prisma.js";

/**
 * PDF worker (`web/backend`) calls entitlement with these `toolId` values
 * (see `routes.py` `_gate_or_402`). Rows must exist or the engine returns
 * `tool_not_registered`.
 *
 * **Source of truth:** `cost` / `strategy` here are synced on every API boot
 * (`upsert` update). Change this file to tune per-tool credit prices, then
 * Restart the Node API after edits so `ensureToolRegistry()` runs again.
 * The web sidebar copy in `web/frontend/src/i18n/workspace.ts`
 * (`SIDEBAR_TOOL_CREDIT_COST`) should match these values for consistent UX.
 */
const DEFAULT_TOOL_REGISTRY: readonly { id: string; strategy: string }[] = [
  { id: "split", strategy: "per_run" },
  { id: "merge", strategy: "per_run" },
  { id: "compress", strategy: "per_run" },
  { id: "encrypt", strategy: "per_run" },
  { id: "pdf-to-word", strategy: "per_run" },
  { id: "word-to-pdf", strategy: "per_run" },
  { id: "excel-to-pdf", strategy: "per_run" },
  { id: "pdf-to-excel", strategy: "per_run" },
  { id: "delete-pages", strategy: "per_run" },
  { id: "rotate-pdf", strategy: "per_run" },
  { id: "organize-pdf", strategy: "per_run" },
  { id: "unlock-pdf", strategy: "per_run" },
  { id: "watermark", strategy: "per_run" },
  { id: "page-numbers", strategy: "per_run" },
  { id: "repair-pdf", strategy: "per_run" },
  { id: "pdf-to-ppt", strategy: "per_run" },
  { id: "ppt-to-pdf", strategy: "per_run" },
  { id: "pdf-to-image", strategy: "per_run" },
  { id: "image-to-pdf", strategy: "per_run" },
  { id: "html-to-pdf", strategy: "per_run" },
  { id: "pdf-to-text", strategy: "per_run" },
  { id: "flatten-pdf", strategy: "per_run" },
];

export async function ensureToolRegistry(): Promise<void> {
  for (const row of DEFAULT_TOOL_REGISTRY) {
    await prisma.toolRegistry.upsert({
      where: { id: row.id },
      create: { id: row.id, strategy: row.strategy },
      update: { strategy: row.strategy },
    });
  }
}
