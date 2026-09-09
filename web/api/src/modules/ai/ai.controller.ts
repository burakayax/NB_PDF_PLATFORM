import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import {
  summarizeDocument,
  chatWithDocument,
  extractData,
  translateDocument,
  translateSegments,
  compareDocuments,
  detectSensitive,
  type ChatTurn,
} from "./ai.service.js";
import { getAiQuota, reserveAiQuota, refundAiQuota, grantAiCredits, TOPUP_PACKS, topupPackById } from "./ai.quota.js";

/** Gönderilebilecek ham metin üst sınırı (service ayrıca 60K'ya kırpar). */
const MAX_TEXT = 200_000;

function getLang(req: Request): "tr" | "en" {
  return req.body?.lang === "en" ? "en" : "tr";
}

/**
 * Hakkı İŞLEMDEN ÖNCE rezerve eder (kontrol + düşüm tek adımda). Hak yoksa 429
 * döner ve `true` verir — çağıran hemen `return` etmelidir.
 *
 * Rezervasyon başarılıysa çağıran, yapay zekâ isteği hata verdiğinde
 * `releaseQuota` ile hakkı iade etmekle yükümlüdür.
 */
async function reserveQuota(req: Request, res: Response, op: string): Promise<boolean> {
  const u = req.authUser;
  if (!u) {
    throw new HttpError(401, "Oturum gerekli.");
  }
  const reserved = await reserveAiQuota(u.id, u.plan, u.role, op);
  if (!reserved) {
    const quota = await getAiQuota(u.id, u.plan, u.role);
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

/** İstek başarısız olursa rezerve edilen hakkı iade eder. */
async function releaseQuota(req: Request): Promise<void> {
  const u = req.authUser;
  if (!u) return;
  await refundAiQuota(u.id, u.plan, u.role);
}

/**
 * Hakkı rezerve eder, işi çalıştırır, iş hata verirse hakkı iade eder.
 * `ok: false` → 429 yanıtı zaten yazıldı, çağıran `return` etmeli.
 */
async function runWithQuota<T>(
  req: Request,
  res: Response,
  op: string,
  work: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false }> {
  if (await reserveQuota(req, res, op)) {
    return { ok: false };
  }
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    await releaseQuota(req);
    throw error;
  }
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
  const run = await runWithQuota(req, res, "summarize", () =>
    summarizeDocument(text.slice(0, MAX_TEXT), getLang(req)),
  );
  if (!run.ok) return;
  const u = req.authUser!;
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ summary: run.value, quota });
}

/** POST /api/ai/extract — { text, lang? } → { data, quota } */
export async function extractController(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!text.trim()) {
    throw new HttpError(400, "Veri çıkarılacak metin boş. PDF'ten metin çıkarılamamış olabilir.");
  }
  const run = await runWithQuota(req, res, "extract", async () => {
    try {
      return await extractData(text.slice(0, MAX_TEXT), getLang(req));
    } catch (e) {
      if (e instanceof Error && e.message === "AI_EXTRACT_PARSE") {
        throw new HttpError(422, "Belgeden yapılandırılmış veri çıkarılamadı. Farklı bir belge deneyin.");
      }
      throw e;
    }
  });
  if (!run.ok) return;
  const u = req.authUser!;
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ data: run.value, quota });
}

/** POST /api/ai/translate — { text, target } → { translation, quota } */
export async function translateController(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const target = typeof req.body?.target === "string" ? req.body.target : "en";
  if (!text.trim()) {
    throw new HttpError(400, "Çevrilecek metin boş. PDF'ten metin çıkarılamamış olabilir.");
  }
  const run = await runWithQuota(req, res, "translate", () =>
    translateDocument(text.slice(0, MAX_TEXT), target),
  );
  if (!run.ok) return;
  const u = req.authUser!;
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ translation: run.value, quota });
}

/** POST /api/ai/translate-segments — { segments: string[], target } → { translations, quota }.
 * Konum-koruyan çeviri: her PDF metin parçası ayrı çevrilir; sıra/sayı korunur. */
export async function translateSegmentsController(req: Request, res: Response): Promise<void> {
  const segments = Array.isArray(req.body?.segments)
    ? (req.body.segments as unknown[]).map((s) => (typeof s === "string" ? s : String(s ?? "")))
    : [];
  const target = typeof req.body?.target === "string" ? req.body.target : "en";
  if (segments.length === 0) {
    throw new HttpError(400, "Çevrilecek metin bulunamadı. PDF'te metin katmanı olmayabilir.");
  }
  const run = await runWithQuota(req, res, "translate", () => translateSegments(segments, target));
  if (!run.ok) return;
  const u = req.authUser!;
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ translations: run.value, quota });
}

/** POST /api/ai/compare — { textA, textB, lang? } → { result, quota } */
export async function compareController(req: Request, res: Response): Promise<void> {
  const textA = typeof req.body?.textA === "string" ? req.body.textA : "";
  const textB = typeof req.body?.textB === "string" ? req.body.textB : "";
  if (!textA.trim() || !textB.trim()) {
    throw new HttpError(400, "Karşılaştırmak için iki belge metni de gerekli.");
  }
  const run = await runWithQuota(req, res, "compare", async () => {
    try {
      return await compareDocuments(textA.slice(0, MAX_TEXT), textB.slice(0, MAX_TEXT), getLang(req));
    } catch (e) {
      if (e instanceof Error && e.message === "AI_COMPARE_PARSE") {
        throw new HttpError(422, "Belgeler karşılaştırılamadı. Farklı belgeler deneyin.");
      }
      throw e;
    }
  });
  if (!run.ok) return;
  const u = req.authUser!;
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ result: run.value, quota });
}

/** POST /api/ai/detect-sensitive — { text, lang? } → { items, quota } */
export async function detectSensitiveController(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!text.trim()) {
    throw new HttpError(400, "Metin boş.");
  }
  const run = await runWithQuota(req, res, "redact", () =>
    detectSensitive(text.slice(0, MAX_TEXT), getLang(req)),
  );
  if (!run.ok) return;
  const u = req.authUser!;
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ items: run.value, quota });
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

  const run = await runWithQuota(req, res, "chat", () =>
    chatWithDocument(text.slice(0, MAX_TEXT), history, question.slice(0, 2000), getLang(req)),
  );
  if (!run.ok) return;
  const u = req.authUser!;
  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.json({ answer: run.value, quota });
}
