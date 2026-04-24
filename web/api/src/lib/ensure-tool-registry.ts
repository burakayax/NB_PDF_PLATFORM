import { prisma } from "./prisma.js";

/**
 * PDF worker (`web/backend`) calls entitlement with these `toolId` values
 * (see `routes.py` `_gate_or_402`). Rows must exist or the engine returns
 * `tool_not_registered`.
 *
 * Costs are defaults for new databases only — `upsert` with empty `update`
 * leaves existing rows untouched so operators can tune via SQL/admin later.
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
];

export async function ensureToolRegistry(): Promise<void> {
  for (const row of DEFAULT_TOOL_REGISTRY) {
    await prisma.toolRegistry.upsert({
      where: { id: row.id },
      create: row,
      update: {},
    });
  }
}
