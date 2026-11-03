/**
 * İçindekiler aracında PDF'leri gruplara (ve alt başlıklara) ayırma mantığı — arayüzden bağımsız, test edilebilir.
 *
 * Kurallar:
 *  • Hiç grup yoksa PDF'ler düz liste olarak birleşir (eski davranış).
 *  • En az bir grup varsa her PDF bir gruba atanmış olmalı; atanmayanlar «gruplanmamış» sayılır.
 *  • Birleşme sırası: grup sırası → (alt başlıksız dosyalar) → alt başlık sırası → dosyaların kendi sırası.
 */

export type TocSubgroup = { id: number; name: string };
export type TocGroup = { id: number; name: string; subs: TocSubgroup[] };
export type Assignable = { id: number; gid: number | null; sid: number | null };

export const MAX_GROUP_NAME = 60;

/** Karşılaştırma için: küçük harf + Türkçe karakterleri sadeleştir. */
export function normalizeTr(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** «FATURALAR» → «fatura»: çoğul ekini at, kökü karşılaştır. */
function kok(ad: string): string {
  const n = normalizeTr(ad).replace(/\s+/g, "");
  const k = n.replace(/(lar|ler)$/, "");
  return k.length >= 3 ? k : n;
}

/** Dosya adından grup/alt başlık önerisi. Hiçbir şeyi kendiliğinden atamaz; yalnız öneri döndürür. */
export function suggestGroup(fileName: string, groups: TocGroup[]): { gid: number; sid: number | null } | null {
  const ad = normalizeTr(fileName.replace(/\.pdf$/i, "")).replace(/\s+/g, "");
  for (const g of groups) {
    const k = kok(g.name);
    if (k.length < 3 || !ad.includes(k)) continue;
    const alt = g.subs.find((s) => {
      const sk = kok(s.name);
      return sk.length >= 3 && ad.includes(sk);
    });
    return { gid: g.id, sid: alt ? alt.id : null };
  }
  return null;
}

/** Hiç grup yoksa boş; varsa hiçbir geçerli gruba bağlı olmayan öğeler. */
export function ungroupedItems<T extends Assignable>(items: T[], groups: TocGroup[]): T[] {
  if (groups.length === 0) return [];
  const ids = new Set(groups.map((g) => g.id));
  return items.filter((i) => i.gid === null || !ids.has(i.gid));
}

/** Birleşme sırası ve her dosyanın grup/alt başlık adı. Grup yoksa öğeler olduğu gibi döner. */
export function orderByGroups<T extends Assignable>(
  items: T[],
  groups: TocGroup[],
): { item: T; group?: string; subgroup?: string }[] {
  if (groups.length === 0) return items.map((item) => ({ item }));
  const out: { item: T; group?: string; subgroup?: string }[] = [];
  for (const g of groups) {
    const ici = items.filter((i) => i.gid === g.id);
    const subIds = new Set(g.subs.map((s) => s.id));
    for (const i of ici) if (i.sid === null || !subIds.has(i.sid)) out.push({ item: i, group: g.name });
    for (const s of g.subs) for (const i of ici) if (i.sid === s.id) out.push({ item: i, group: g.name, subgroup: s.name });
  }
  return out;
}
