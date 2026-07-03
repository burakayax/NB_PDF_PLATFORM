import type { Request, Response } from "express";
import { summarizeDocument, extractData, translateDocument } from "../ai/ai.service.js";
import { getAiQuota, consumeAiQuota, hasAiQuota } from "../ai/ai.quota.js";
import { extractPdfText } from "../../lib/pdf-text.js";
import { problem } from "./v1.errors.js";
import type { ApiUser } from "./v1.middleware.js";

const MAX_TEXT = 200_000;

function apiUser(res: Response): ApiUser {
  return (res.locals as { apiUser?: ApiUser }).apiUser as ApiUser;
}

/** Girdi metnini çöz: yüklenen PDF (multipart `file`) → cihazda çıkar, yoksa gövde `text`. */
async function resolveText(req: Request): Promise<{ text: string; source: "file" | "text" } | { error: string; code: string }> {
  const file = (req as Request & { file?: { buffer: Buffer; mimetype: string } }).file;
  if (file?.buffer) {
    if (file.mimetype && file.mimetype !== "application/pdf") {
      return { error: "Yalnız application/pdf yüklenebilir.", code: "unsupported_media_type" };
    }
    let text = "";
    try {
      text = await extractPdfText(file.buffer);
    } catch {
      return { error: "PDF okunamadı ya da bozuk.", code: "unprocessable_entity" };
    }
    if (text.trim().length < 10) {
      return { error: "PDF'ten metin çıkarılamadı (taranmış/görüntü olabilir). 'text' alanıyla düz metin gönderin.", code: "unprocessable_entity" };
    }
    return { text, source: "file" };
  }
  const t = typeof req.body?.text === "string" ? req.body.text : "";
  return { text: t, source: "text" };
}

function getLang(req: Request): "tr" | "en" {
  const l = typeof req.body?.lang === "string" ? req.body.lang : "";
  return l === "en" ? "en" : "tr";
}

/** İşlemden ÖNCE kredi var mı (yoksa 402). true = engellendi. */
async function requireCredits(res: Response): Promise<boolean> {
  const u = apiUser(res);
  if (await hasAiQuota(u.id, u.plan, u.role)) return false;
  problem(res, 402, "insufficient_credits", "AI krediniz tükendi. Kredi paketi (top-up) ekleyin.");
  return true;
}

/** İşlemden SONRA: 1 kredi düş + kalan krediyi başlık ve gövdeye ekle. */
async function withUsage(res: Response, payload: Record<string, unknown>): Promise<void> {
  const u = apiUser(res);
  await consumeAiQuota(u.id, u.plan, u.role);
  const quota = await getAiQuota(u.id, u.plan, u.role);
  if (!quota.unlimited && quota.remaining != null) {
    res.setHeader("X-Credits-Remaining", String(quota.remaining));
  }
  res.json({ ...payload, usage: { remaining: quota.remaining, unlimited: quota.unlimited } });
}

/** GET /v1/me — anahtar geçerli + kalan kota. */
export async function v1MeController(_req: Request, res: Response): Promise<void> {
  const u = apiUser(res);
  const quota = await getAiQuota(u.id, u.plan, u.role);
  if (!quota.unlimited && quota.remaining != null) res.setHeader("X-Credits-Remaining", String(quota.remaining));
  res.json({ ok: true, plan: u.plan, usage: { remaining: quota.remaining, unlimited: quota.unlimited } });
}

async function run(
  req: Request,
  res: Response,
  op: (text: string) => Promise<Record<string, unknown>>,
): Promise<void> {
  const resolved = await resolveText(req);
  if ("error" in resolved) {
    const status = resolved.code === "unsupported_media_type" ? 415 : 422;
    problem(res, status, resolved.code, resolved.error);
    return;
  }
  if (!resolved.text.trim()) {
    problem(res, 400, "invalid_request", "'text' alanı ya da 'file' (PDF) zorunludur.");
    return;
  }
  if (await requireCredits(res)) return;
  const payload = await op(resolved.text.slice(0, MAX_TEXT));
  if (res.headersSent) return; // op zaten yanıt verdi (ör. çıkarım parse hatası)
  await withUsage(res, payload);
}

/** POST /v1/summarize — { text | file, lang? } → { summary } */
export async function v1SummarizeController(req: Request, res: Response): Promise<void> {
  await run(req, res, async (text) => ({ summary: await summarizeDocument(text, getLang(req)) }));
}

/** POST /v1/extract — { text | file, lang? } → { data } */
export async function v1ExtractController(req: Request, res: Response): Promise<void> {
  await run(req, res, async (text) => {
    try {
      return { data: await extractData(text, getLang(req)) };
    } catch (e) {
      if (e instanceof Error && e.message === "AI_EXTRACT_PARSE") {
        problem(res, 422, "unprocessable_entity", "Yapılandırılmış veri çıkarılamadı.");
        return {};
      }
      throw e;
    }
  });
}

/** POST /v1/translate — { text | file, target } → { translation } */
export async function v1TranslateController(req: Request, res: Response): Promise<void> {
  const target = typeof req.body?.target === "string" ? req.body.target : "en";
  await run(req, res, async (text) => ({ translation: await translateDocument(text, target) }));
}
