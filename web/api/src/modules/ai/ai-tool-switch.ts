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

export const AI_TOOL_NOTE_MAX = 200;

async function readFlags(): Promise<{ states: AiToolStates; notes: Record<string, string> } | null> {
  try {
    const raw = await getSetting(SITE_SETTING_KEYS.GLOBAL_FLAGS);
    const root = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const states: AiToolStates = {};
    const notes: Record<string, string> = {};
    const s = root.aiToolStates;
    if (s && typeof s === "object" && !Array.isArray(s)) {
      for (const [k, v] of Object.entries(s as Record<string, unknown>)) if (v === "open" || v === "closed") states[k] = v;
    }
    const n = root.aiToolNotes;
    if (n && typeof n === "object" && !Array.isArray(n)) {
      for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) notes[k] = v.trim().slice(0, AI_TOOL_NOTE_MAX);
      }
    }
    return { states, notes };
  } catch {
    return null;
  }
}

/** Araç bu rol için açık mı? ADMIN her zaman kullanabilir. */
export async function isAiToolOpen(id: AiToolId, role: string | undefined): Promise<boolean> {
  if (role === "ADMIN") return true;
  const f = await readFlags();
  if (!f) return false;
  const def = AI_TOOL_CATALOG.find((t) => t.id === id)?.defaultOpen ?? false;
  return f.states[id] ? f.states[id] === "open" : def;
}

/** Kapalı araçların kimlikleri (arayüzün "Çok Yakında" göstermesi için). */
export async function closedAiTools(role: string | undefined): Promise<AiToolId[]> {
  const out: AiToolId[] = [];
  for (const t of AI_TOOL_CATALOG) if (!(await isAiToolOpen(t.id, role))) out.push(t.id);
  return out;
}

export const AI_TOOL_CLOSED_MESSAGE = "Bu araç şu an kullanıma kapalı. Çok yakında.";

/** Admin'in araç kapatılırken yazdığı not; yoksa varsayılan mesaj. Kullanıcıya aynen gösterilir. */
export async function aiToolClosedMessage(id: AiToolId): Promise<string> {
  const f = await readFlags();
  return f?.notes[id] || AI_TOOL_CLOSED_MESSAGE;
}

/** Kapalı araçlar için admin notları (yalnızca not yazılmış olanlar). */
export async function closedAiToolNotes(role: string | undefined): Promise<Record<string, string>> {
  const f = await readFlags();
  const out: Record<string, string> = {};
  if (!f) return out;
  for (const id of await closedAiTools(role)) if (f.notes[id]) out[id] = f.notes[id];
  return out;
}

/** Rota koruması: araç kapalıysa 503 (maliyet ve kredi doğmadan). */
export function requireAiTool(id: AiToolId) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!(await isAiToolOpen(id, req.authUser?.role))) {
      res.status(503).json({ error: "ai_unavailable", message: await aiToolClosedMessage(id) });
      return;
    }
    next();
  };
}
