/**
 * ÇALIŞMA ALANI YARDIMCILARI — yüklenen dosya listesi, geçen süre metni,
 * kullanıcı iptali ayırt etme ve birleştirme ızgarasında sürükleme hesapları.
 *
 * Saf fonksiyonlar; ekran durumuna bakmazlar.
 */
export function createUploadItems(fileList: File[]) {
  // Tarayıcı File listesini arayüz state modeline çevirir; her öğeye kararlı id ve şifre alanı ekler.
  // Birleştirme sırası ve liste render'ı bu yapı üzerinden yürüdüğünden tutarlı şema gereklidir.
  // Id üretimi zayıflarsa React anahtarları çakışır; sürükle-bırak ve güncelleme davranışı bozulabilir.
  return fileList.map((file) => ({
    id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    encrypted: false,
    inspecting: false,
    password: "",
    pageCount: null,
    imageRatio: null,
    mergePasswordVerified: false,
    corrupt: false,
  }));
}

export function formatElapsed(seconds: number) {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function isUserAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") {
    return true;
  }
  if (e instanceof Error && e.name === "AbortError") {
    return true;
  }
  return false;
}

/** Birleştirme listesinde imleç Y konumuna göre hedef satır indeksi (yer değiştirme önizlemesi için). */
export function mergePointerYToIndex(
  clientY: number,
  container: HTMLElement | null,
): number {
  if (!container) {
    return 0;
  }
  const cards = [
    ...container.querySelectorAll("[data-merge-row-index]"),
  ] as HTMLElement[];
  if (cards.length === 0) {
    return 0;
  }
  for (let i = 0; i < cards.length; i++) {
    const br = cards[i].getBoundingClientRect();
    if (clientY >= br.top && clientY <= br.bottom) {
      return i;
    }
  }
  const first = cards[0].getBoundingClientRect();
  if (clientY < first.top) {
    return 0;
  }
  const last = cards[cards.length - 1].getBoundingClientRect();
  if (clientY > last.bottom) {
    return cards.length - 1;
  }
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < cards.length; i++) {
    const br = cards[i].getBoundingClientRect();
    const mid = br.top + br.height / 2;
    const d = Math.abs(clientY - mid);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Sürüklerken diğer satırların kayarak ara açılmasını sağlar (kaynak ve hedef indeks arası). */
export function getReorderPreviewOffset(
  index: number,
  from: number,
  to: number,
  slot: number,
): number {
  if (from < 0 || from === to || slot <= 0) {
    return 0;
  }
  if (from < to) {
    if (index > from && index <= to) {
      return -slot;
    }
  } else if (from > to) {
    if (index >= to && index < from) {
      return slot;
    }
  }
  return 0;
}
