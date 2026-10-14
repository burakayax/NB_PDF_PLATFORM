/**
 * KAYITLI İMZALARIM — üyeye özel avantaj (PDF İmzala).
 *
 * İmza görseli yalnızca bu cihazın tarayıcısında saklanır (localStorage) ve hesaba bağlı bir anahtarla
 * ayrılır: aynı cihazda başka hesaba geçen kişi önceki kişinin imzasını GÖRMEZ. Sunucuya hiçbir şey
 * gönderilmez (gizlilik: imza dosya gibi cihazdan çıkmaz). Misafirde kaydetme yoktur — bu, ücretsiz hesap
 * açmak için somut bir sebeptir.
 *
 * En fazla {@link MAX_SAVED_SIGNATURES} imza tutulur; yenisi eklenince en eski silinir. Depolama
 * dolarsa/yasaksa (özel mod) sessizce vazgeçilir, araç etkilenmez.
 */
export type SavedSignature = { id: string; dataUrl: string; aspect: number; savedAt: number };

export const MAX_SAVED_SIGNATURES = 3;
const KEY_PREFIX = "nb_saved_signatures_v1:";

/** JWT erişim belirtecinin `sub` (kullanıcı kimliği) alanı; çözülemezse null (misafir/geçersiz). */
export function userKeyFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}

function read(userKey: string): SavedSignature[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userKey);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x): x is SavedSignature =>
          !!x && typeof x === "object" && typeof (x as SavedSignature).dataUrl === "string" && typeof (x as SavedSignature).id === "string",
      )
      .slice(0, MAX_SAVED_SIGNATURES);
  } catch {
    return [];
  }
}

function write(userKey: string, list: SavedSignature[]): boolean {
  try {
    localStorage.setItem(KEY_PREFIX + userKey, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function loadSavedSignatures(userKey: string | null): SavedSignature[] {
  return userKey ? read(userKey) : [];
}

/** Aynı görsel zaten kayıtlıysa tekrar eklenmez (başa alınır). Güncel listeyi döndürür. */
export function saveSignature(userKey: string | null, sig: { dataUrl: string; aspect: number }): SavedSignature[] {
  if (!userKey) return [];
  const current = read(userKey);
  const dup = current.find((s) => s.dataUrl === sig.dataUrl);
  const entry: SavedSignature = dup ?? {
    id: `sig_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    dataUrl: sig.dataUrl,
    aspect: sig.aspect,
    savedAt: Date.now(),
  };
  const next = [entry, ...current.filter((s) => s.id !== entry.id)].slice(0, MAX_SAVED_SIGNATURES);
  return write(userKey, next) ? next : current;
}

export function deleteSavedSignature(userKey: string | null, id: string): SavedSignature[] {
  if (!userKey) return [];
  const next = read(userKey).filter((s) => s.id !== id);
  write(userKey, next);
  return next;
}
