import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import {
  summarizeDocument,
  chatWithDocument,
  type ChatTurn,
} from "./ai.service.js";

/** Gönderilebilecek ham metin üst sınırı (service ayrıca 60K'ya kırpar). */
const MAX_TEXT = 200_000;

function getLang(req: Request): "tr" | "en" {
  return req.body?.lang === "en" ? "en" : "tr";
}

/** POST /api/ai/summarize — { text, lang? } → { summary } */
export async function summarizeController(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!text.trim()) {
    throw new HttpError(400, "Özetlenecek metin boş. PDF'ten metin çıkarılamamış olabilir.");
  }
  const summary = await summarizeDocument(text.slice(0, MAX_TEXT), getLang(req));
  res.json({ summary });
}

/** POST /api/ai/chat — { text, question, history?, lang? } → { answer } */
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

  const answer = await chatWithDocument(
    text.slice(0, MAX_TEXT),
    history,
    question.slice(0, 2000),
    getLang(req),
  );
  res.json({ answer });
}
