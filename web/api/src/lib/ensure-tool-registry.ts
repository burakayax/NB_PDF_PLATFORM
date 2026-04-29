import { prisma } from "./prisma.js";

/**
 * PDF worker (`web/backend`) calls entitlement with these `toolId` values
 * (see `routes.py` `_gate_or_402`). Rows must exist or the engine returns
 * `tool_not_registered`.
 *
 * **Source of truth:** `cost` / `strategy` here are synced on every API boot
 * (`upsert` update). Change this file to tune per-tool credit prices, then
 * restart the Node API (or Docker) so `ensureToolRegistry()` runs again.
 * The web sidebar copy in `web/frontend/src/i18n/workspace.ts`
 * (`SIDEBAR_TOOL_CREDIT_COST`) should match these values for consistent UX.
 */
const DEFAULT_TOOL_REGISTRY: readonly { id: string; strategy: string; cost: number }[] = [
  { id: "split", strategy: "per_run", cost: 2 },
  { id: "merge", strategy: "per_run", cost: 3 },
  { id: "compress", strategy: "per_run", cost: 2 },
  { id: "encrypt", strategy: "per_run", cost: 2 },
  { id: "pdf-to-word", strategy: "per_run", cost: 3 },
  { id: "word-to-pdf", strategy: "per_run", cost: 3 },
  { id: "excel-to-pdf", strategy: "per_run", cost: 3 },
  { id: "pdf-to-excel", strategy: "per_run", cost: 3 },
  { id: "delete-pages", strategy: "per_run", cost: 1 },
  { id: "rotate-pdf", strategy: "per_run", cost: 2 },
  { id: "organize-pdf", strategy: "per_run", cost: 2 },
  { id: "unlock-pdf", strategy: "per_run", cost: 2 },
  { id: "watermark", strategy: "per_run", cost: 2 },
  { id: "page-numbers", strategy: "per_run", cost: 2 },
  { id: "repair-pdf", strategy: "per_run", cost: 2 },
  { id: "pdf-to-ppt", strategy: "per_run", cost: 4 },
  { id: "ppt-to-pdf", strategy: "per_run", cost: 3 },
  { id: "pdf-to-image", strategy: "per_run", cost: 3 },
  { id: "image-to-pdf", strategy: "per_run", cost: 3 },
  { id: "html-to-pdf", strategy: "per_run", cost: 3 },
];

export async function ensureToolRegistry(): Promise<void> {
  for (const row of DEFAULT_TOOL_REGISTRY) {
    await prisma.toolRegistry.upsert({
      where: { id: row.id },
      create: row,
      update: { cost: row.cost, strategy: row.strategy },
    });
  }
}
