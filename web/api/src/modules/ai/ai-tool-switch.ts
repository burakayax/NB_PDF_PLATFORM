import type { NextFunction, Request, Response } from "express";
import { getSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";

/**
 * AI araçları için TEK TEK açma/kapama (admin paneli → Sistem Kontrol → "Yapay zekâ araçları").
 *
 * Durumlar `global.flags.aiToolStates` içinde saklanır: { "pdf-ozetle": "open" | "closed" }.
 * Kaydı olmayan araç, aşağıdaki `defaultOpen` değerini kullanır. Sözleşme Denetçisi satışa hazır
 * olana kadar KAPALI doğar (güvenli varsayılan). ADMIN kapalı araçları da deneyebilir.
 * Okuma hatası → o aracın varsayılanı yerine KAPALI (maliyet/risk tarafında güvenli).
 *
 * "ai-toplu-islem" listede yok: kendi ucu yoktur, diğer araçların uçlarını kullanır.
 */
export type AiToolId =
  | "pdf-ozetle"
  | "pdf-sohbet"
  | "pdf-ceviri"
  | "pdf-karsilastir"
  | "pdf-veri-cikar"
  | "hassas-veri-gizle"
  | "sozlesme-denetci";

export const AI_TOOL_CATALOG: readonly { id: AiToolId; label: string; description: string; defaultOpen: boolean }[] = [
  { id: "pdf-ozetle", label: "PDF Özetle", description: "Belgenin kısa özetini çıkarır.", defaultOpen: true },
  { id: "pdf-sohbet", label: "PDF ile Sohbet", description: "Belgeye soru sorulan sohbet aracı.", defaultOpen: true },
  { id: "pdf-ceviri", label: "PDF Çevir", description: "Belgeyi başka bir dile çevirir.", defaultOpen: true },
  { id: "pdf-karsilastir", label: "PDF Karşılaştır", description: "İki belge arasındaki farkları bulur.", defaultOpen: true },
  { id: "pdf-veri-cikar", label: "PDF'ten Veri Çıkar", description: "Belgeden tablo ve alan verisi çıkarır.", defaultOpen: true },
  { id: "hassas-veri-gizle", label: "Hassas Veri Gizle", description: "Kişisel verileri bulur ve karartır.", defaultOpen: true },
  { id: "sozlesme-denetci", label: "Sözleşme Denetçisi", description: "Sözleşme ve ihale belgelerindeki riskleri bulur. Satışa hazır olana kadar kapalı tutulur.", defaultOpen: false },
];

export type AiToolStates = Record<string, "open" | "closed">;

async function readStates(): Promise<AiToolStates | null> {
  try {
    const raw = await getSetting(SITE_SETTING_KEYS.GLOBAL_FLAGS);
    const s = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>).aiToolStates : undefined;
    const out: AiToolStates = {};
    if (s && typeof s === "object" && !Array.isArray(s)) {
      for (const [k, v] of Object.entries(s as Record<string, unknown>)) if (v === "open" || v === "closed") out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

/** Araç bu rol için açık mı? ADMIN her zaman kullanabilir. */
export async function isAiToolOpen(id: AiToolId, role: string | undefined): Promise<boolean> {
  if (role === "ADMIN") return true;
  const states = await readStates();
  if (!states) return false;
  const def = AI_TOOL_CATALOG.find((t) => t.id === id)?.defaultOpen ?? false;
  return states[id] ? states[id] === "open" : def;
}

/** Kapalı araçların kimlikleri (arayüzün "Çok Yakında" göstermesi için). */
export async function closedAiTools(role: string | undefined): Promise<AiToolId[]> {
  const out: AiToolId[] = [];
  for (const t of AI_TOOL_CATALOG) if (!(await isAiToolOpen(t.id, role))) out.push(t.id);
  return out;
}

export const AI_TOOL_CLOSED_MESSAGE = "Bu araç şu an kullanıma kapalı. Çok yakında.";

/** Rota koruması: araç kapalıysa 503 (maliyet ve kredi doğmadan). */
export function requireAiTool(id: AiToolId) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!(await isAiToolOpen(id, req.authUser?.role))) {
      res.status(503).json({ error: "ai_unavailable", message: AI_TOOL_CLOSED_MESSAGE });
      return;
    }
    next();
  };
}
