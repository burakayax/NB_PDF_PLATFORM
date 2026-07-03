import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { summarizeDocument, extractData, translateDocument } from "../ai/ai.service.js";
import { getAiQuota, consumeAiQuota, hasAiQuota } from "../ai/ai.quota.js";
import type { ApiUser } from "./v1.middleware.js";

const MAX_TEXT = 200_000;

function apiUser(res: Response): ApiUser {
  const u = (res.locals as { apiUser?: ApiUser }).apiUser;
  if (!u) throw new HttpError(401, "invalid_api_key");
  return u;
}
function getText(req: Request): string {
  return typeof req.body?.text === "string" ? req.body.text : "";
}
function getLang(req: Request): "tr" | "en" {
  return req.body?.lang === "en" ? "en" : "tr";
}

/** Kota (kredi) kontrolü — yoksa 429 (true = engellendi). */
async function blocked(res: Response): Promise<boolean> {
  const u = apiUser(res);
  if (await hasAiQuota(u.id, u.plan, u.role)) return false;
  res.status(429).json({ error: "quota_exceeded", message: "AI kotanız/krediniz tükendi. Kredi ekleyin." });
  return true;
}
async function finish(res: Response, payload: Record<string, unknown>): Promise<void> {
  const u = apiUser(res);
  await consumeAiQuota(u.id, u.plan, u.role);
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ ...payload, usage: { remaining: quota.remaining, unlimited: quota.unlimited } });
}

/** GET /v1/me — anahtar geçerli mi + kalan kota. */
export async function v1MeController(_req: Request, res: Response): Promise<void> {
  const u = apiUser(res);
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ ok: true, plan: u.plan, usage: { remaining: quota.remaining, unlimited: quota.unlimited } });
}

/** POST /v1/summarize — { text, lang? } → { summary } */
export async function v1SummarizeController(req: Request, res: Response): Promise<void> {
  const text = getText(req);
  if (!text.trim()) throw new HttpError(400, "'text' alanı zorunludur.");
  if (await blocked(res)) return;
  const summary = await summarizeDocument(text.slice(0, MAX_TEXT), getLang(req));
  await finish(res, { summary });
}

/** POST /v1/extract — { text, lang? } → { data } */
export async function v1ExtractController(req: Request, res: Response): Promise<void> {
  const text = getText(req);
  if (!text.trim()) throw new HttpError(400, "'text' alanı zorunludur.");
  if (await blocked(res)) return;
  let data;
  try {
    data = await extractData(text.slice(0, MAX_TEXT), getLang(req));
  } catch (e) {
    if (e instanceof Error && e.message === "AI_EXTRACT_PARSE") throw new HttpError(422, "Yapılandırılmış veri çıkarılamadı.");
    throw e;
  }
  await finish(res, { data });
}

/** POST /v1/translate — { text, target } → { translation } */
export async function v1TranslateController(req: Request, res: Response): Promise<void> {
  const text = getText(req);
  const target = typeof req.body?.target === "string" ? req.body.target : "en";
  if (!text.trim()) throw new HttpError(400, "'text' alanı zorunludur.");
  if (await blocked(res)) return;
  const translation = await translateDocument(text.slice(0, MAX_TEXT), target);
  await finish(res, { translation });
}
