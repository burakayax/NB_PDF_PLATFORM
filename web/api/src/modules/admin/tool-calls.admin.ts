import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { listToolCalls, summarizeToolCalls } from "../../lib/tool-call-log.js";

const int = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** GET /api/admin/tool-calls?hours=24&tool=&outcome=all|ok|error&userId=&page=1 — özet + sayfalı liste. */
export async function adminToolCallsController(req: Request, res: Response): Promise<void> {
  const hours = int(req.query["hours"], 24, 1, 24 * 30);
  const outcomeRaw = String(req.query["outcome"] ?? "all");
  if (!["all", "ok", "error"].includes(outcomeRaw)) throw new HttpError(400, "outcome all, ok veya error olmalı.");
  const toolQ = req.query["tool"];
  const userQ = req.query["userId"];
  const tool = typeof toolQ === "string" && toolQ ? toolQ.slice(0, 200) : undefined;
  const userId = typeof userQ === "string" && userQ ? userQ.slice(0, 64) : undefined;
  const [summary, list] = await Promise.all([
    summarizeToolCalls(hours),
    listToolCalls({ hours, tool, userId, outcome: outcomeRaw as "all" | "ok" | "error", page: int(req.query["page"], 1, 1, 10_000), pageSize: 50 }),
  ]);
  res.json({ hours, summary, ...list });
}
