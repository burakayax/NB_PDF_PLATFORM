import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import {
  summarizeDocument,
  chatWithDocument,
  extractData,
  type ChatTurn,
} from "./ai.service.js";
import { getAiQuota, consumeAiQuota } from "./ai.quota.js";

/** Gönderilebilecek ham metin üst sınırı (service ayrıca 60K'ya kırpar). */
const MAX_TEXT = 200_000;

function getLang(req: Request): "tr" | "en" {
  return req.body?.lang === "en" ? "en" : "tr";
}

/** Kota kontrolü: doluysa 429 döner (true = engellendi, çağıran return etmeli). */
async function blockedByQuota(req: Request, res: Response): Promise<boolean> {
  const u = req.authUser;
  if (!u) {
    throw new HttpError(401, "Oturum gerekli.");
  }
  const quota = await getAiQuota(u.id, u.plan, u.role);
  if (!quota.unlimited && (quota.remaining ?? 0) <= 0) {
    res.status(429).json({
      error: "quota_exceeded",
      message:
        "Bu ayki yapay zekâ kotan doldu. Kotan ay başında otomatik yenilenir.",
      quota,
    });
    return true;
  }
  return false;
}

/** GET /api/ai/quota → { quota } */
export async function quotaController(req: Request, res: Response): Promise<void> {
  const u = req.authUser;
  if (!u) {
    throw new HttpError(401, "Oturum gerekli.");
  }
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ quota });
}

/** POST /api/ai/summarize — { text, lang? } → { summary, quota } */
export async function summarizeController(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!text.trim()) {
    throw new HttpError(400, "Özetlenecek metin boş. PDF'ten metin çıkarılamamış olabilir.");
  }
  if (await blockedByQuota(req, res)) return;

  const summary = await summarizeDocument(text.slice(0, MAX_TEXT), getLang(req));
  const u = req.authUser!;
  await consumeAiQuota(u.id);
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ summary, quota });
}

/** POST /api/ai/extract — { text, lang? } → { data, quota } */
export async function extractController(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!text.trim()) {
    throw new HttpError(400, "Veri çıkarılacak metin boş. PDF'ten metin çıkarılamamış olabilir.");
  }
  if (await blockedByQuota(req, res)) return;

  let data;
  try {
    data = await extractData(text.slice(0, MAX_TEXT), getLang(req));
  } catch (e) {
    if (e instanceof Error && e.message === "AI_EXTRACT_PARSE") {
      throw new HttpError(422, "Belgeden yapılandırılmış veri çıkarılamadı. Farklı bir belge deneyin.");
    }
    throw e;
  }
  const u = req.authUser!;
  await consumeAiQuota(u.id);
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ data, quota });
}

/** POST /api/ai/chat — { text, question, history?, lang? } → { answer, quota } */
export async function chatController(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const question = typeof req.body?.question === "string" ? req.body.question : "";
  if (!text.trim()) {
    throw new HttpError(400, "Belge metni boş.");
  }
  if (!question.trim()) {
    throw new HttpError(400, "Soru boş.");
  }
  if (await blockedByQuota(req, res)) return;

  const rawHistory: unknown[] = Array.isArray(req.body?.history) ? req.body.history : [];
  const history: ChatTurn[] = [];
  for (const t of rawHistory) {
    if (t && typeof t === "object") {
      const role = (t as { role?: unknown }).role;
      const content = (t as { content?: unknown }).content;
      if ((role === "user" || role === "assistant") && typeof content === "string") {
        history.push({ role, content: content.slice(0, 4000) });
      }
    }
  }

  const answer = await chatWithDocument(
    text.slice(0, MAX_TEXT),
    history,
    question.slice(0, 2000),
    getLang(req),
  );
  const u = req.authUser!;
  await consumeAiQuota(u.id);
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ answer, quota });
}
