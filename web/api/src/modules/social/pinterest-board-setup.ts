/**
 * Pinterest panolarının kurulumu: hesaptaki panoları 6 hedef panoyla eşleştirir, eksikleri (onayla) oluşturur.
 *
 * Eşleştirme AD üzerinden yapılır (büyük/küçük harf ve Türkçe karakter farkı yok sayılır). Pano kimlikleri
 * ayarlarda saklanır ve hangi ORTAMDA (kum havuzu / gerçek) eşleştirildiği de yazılır: kutu kapanınca
 * kum havuzu kimlikleri geçmez, işlem gerçek hesapta bir kez daha yapılmalıdır.
 */

import { PIN_BOARDS, PIN_BOARD_KEYS, type PinBoardKey } from "./pinterest-boards.config.js";
import { foldText } from "./pinterest-board.js";
import { createPinterestBoard, listPinterestBoards, type PinterestBoard } from "./platforms/pinterest.platform.js";
import type { SocialAutomationConfig } from "./social.service.js";

export type BoardSource = "kayıtlı" | "adla bulundu" | "eksik";

export type BoardSetupRow = {
  key: PinBoardKey;
  name: string;
  description: string;
  boardId: string | null;
  source: BoardSource;
};

export type BoardSetupState = {
  sandbox: boolean;
  /** Eşleşme başka ortamda yapılmış (kutu değişti): kimlikler geçmez, yeniden eşleştirilmeli. */
  envMismatch: boolean;
  rows: BoardSetupRow[];
  missingCount: number;
};

export const envOf = (sandbox: boolean): "sandbox" | "production" => (sandbox ? "sandbox" : "production");

/** SAF: hedef panoların mevcut durumunu hesaplar (ağ yok). */
export function computeBoardSetup(
  existing: PinterestBoard[],
  saved: Partial<Record<PinBoardKey, string>>,
  savedEnv: "sandbox" | "production" | null,
  sandbox: boolean,
): BoardSetupState {
  const envMismatch = Boolean(savedEnv) && savedEnv !== envOf(sandbox);
  const byName = new Map<string, PinterestBoard>();
  for (const b of existing) if (!byName.has(foldText(b.name))) byName.set(foldText(b.name), b);

  const rows = PIN_BOARD_KEYS.map((key): BoardSetupRow => {
    const { name, description } = PIN_BOARDS[key];
    const savedId = envMismatch ? undefined : saved[key];
    if (savedId && existing.some((b) => b.id === savedId)) return { key, name, description, boardId: savedId, source: "kayıtlı" };
    const found = byName.get(foldText(name));
    if (found) return { key, name, description, boardId: found.id, source: "adla bulundu" };
    return { key, name, description, boardId: null, source: "eksik" };
  });
  return { sandbox, envMismatch, rows, missingCount: rows.filter((r) => r.source === "eksik").length };
}

export async function inspectBoards(secrets: Record<string, string>, config: SocialAutomationConfig): Promise<BoardSetupState> {
  const existing = await listPinterestBoards(secrets);
  return computeBoardSetup(existing, config.pinterestBoards, config.pinterestBoardsEnv, config.pinterestSandbox);
}

/**
 * Bulunan panoları bağlar; `createMissing` doğruysa eksik olanları herkese açık olarak oluşturur.
 * Dönen satırlar yeni durumu gösterir; kaydedilecek eşleme `boards` içindedir.
 */
export async function syncBoards(
  secrets: Record<string, string>,
  config: SocialAutomationConfig,
  createMissing: boolean,
): Promise<{ state: BoardSetupState; boards: Partial<Record<PinBoardKey, string>>; created: PinBoardKey[] }> {
  const state = await inspectBoards(secrets, config);
  const boards: Partial<Record<PinBoardKey, string>> = {};
  const created: PinBoardKey[] = [];
  for (const row of state.rows) {
    if (row.boardId) {
      boards[row.key] = row.boardId;
      continue;
    }
    if (!createMissing) continue;
    const board = await createPinterestBoard(secrets, row.name, row.description);
    boards[row.key] = board.id;
    created.push(row.key);
  }
  const rows = state.rows.map((r) => (boards[r.key] ? { ...r, boardId: boards[r.key]!, source: r.source === "eksik" ? ("kayıtlı" as const) : r.source } : r));
  return { state: { ...state, rows, missingCount: rows.filter((r) => !r.boardId).length, envMismatch: false }, boards, created };
}
