import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import {
  summarizeDocument,
  chatWithDocument,
  extractData,
  translateDocument,
  compareDocuments,
  detectSensitive,
  type ChatTurn,
} from "./ai.service.js";
import { getAiQuota, consumeAiQuota, grantAiCredits, TOPUP_PACKS, topupPackById } from "./ai.quota.js";

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

/** GET /api/ai/topup/packs → { packs } — ek AI kredisi paketleri. */
export async function topupPacksController(_req: Request, res: Response): Promise<void> {
  res.json({ packs: TOPUP_PACKS });
}

/** POST /api/ai/topup/grant → { userId?, packId } — ADMIN: kredi ver (manuel/test).
 * Ödeme entegrasyonu açılınca gerçek satın alma callback'i grantAiCredits'i çağıracak. */
export async function topupGrantController(req: Request, res: Response): Promise<void> {
  const u = req.authUser;
  if (!u) throw new HttpError(401, "Oturum gerekli.");
  if (u.role !== "ADMIN") throw new HttpError(403, "Bu işlem yalnız admin içindir.");
  const packId = typeof req.body?.packId === "string" ? req.body.packId : "";
  const pack = topupPackById(packId);
  if (!pack) throw new HttpError(400, "Geçersiz paket.");
  const targetUserId = typeof req.body?.userId === "string" && req.body.userId ? req.body.userId : u.id;
  await grantAiCredits(targetUserId, pack.credits);
  const quota = await getAiQuota(targetUserId, u.plan, u.role);
  res.json({ granted: pack.credits, quota });
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
  await consumeAiQuota(u.id, u.plan, u.role, "summarize");
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
  await consumeAiQuota(u.id, u.plan, u.role, "extract");
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ data, quota });
}

/** POST /api/ai/translate — { text, target } → { translation, quota } */
export async function translateController(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const target = typeof req.body?.target === "string" ? req.body.target : "en";
  if (!text.trim()) {
    throw new HttpError(400, "Çevrilecek metin boş. PDF'ten metin çıkarılamamış olabilir.");
  }
  if (await blockedByQuota(req, res)) return;

  const translation = await translateDocument(text.slice(0, MAX_TEXT), target);
  const u = req.authUser!;
  await consumeAiQuota(u.id, u.plan, u.role, "translate");
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ translation, quota });
}

/** POST /api/ai/compare — { textA, textB, lang? } → { result, quota } */
export async function compareController(req: Request, res: Response): Promise<void> {
  const textA = typeof req.body?.textA === "string" ? req.body.textA : "";
  const textB = typeof req.body?.textB === "string" ? req.body.textB : "";
  if (!textA.trim() || !textB.trim()) {
    throw new HttpError(400, "Karşılaştırmak için iki belge metni de gerekli.");
  }
  if (await blockedByQuota(req, res)) return;

  let result;
  try {
    result = await compareDocuments(textA.slice(0, MAX_TEXT), textB.slice(0, MAX_TEXT), getLang(req));
  } catch (e) {
    if (e instanceof Error && e.message === "AI_COMPARE_PARSE") {
      throw new HttpError(422, "Belgeler karşılaştırılamadı. Farklı belgeler deneyin.");
    }
    throw e;
  }
  const u = req.authUser!;
  await consumeAiQuota(u.id, u.plan, u.role, "compare");
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ result, quota });
}

/** POST /api/ai/detect-sensitive — { text, lang? } → { items, quota } */
export async function detectSensitiveController(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!text.trim()) {
    throw new HttpError(400, "Metin boş.");
  }
  if (await blockedByQuota(req, res)) return;

  const items = await detectSensitive(text.slice(0, MAX_TEXT), getLang(req));
  const u = req.authUser!;
  await consumeAiQuota(u.id, u.plan, u.role, "redact");
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ items, quota });
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
  await consumeAiQuota(u.id, u.plan, u.role, "chat");
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ answer, quota });
}
