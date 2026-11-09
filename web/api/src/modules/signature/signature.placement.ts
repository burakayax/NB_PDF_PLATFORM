/**
 * İMZA YERİ TERCİHİ — isteği gönderen belirler, imzalayan değiştiremez.
 *
 * NEDEN GÖNDEREN SEÇER: İmzanın yeri belgenin parçasıdır. İmzalayana bırakılırsa
 * imza yanlış yere atılıp sonradan itiraz konusu olabilir. Gönderen hangi
 * sayfalara, belgenin neresine imza istediğini bilir ve onaylayarak gönderir.
 */
import { HttpError } from "../../lib/http-error.js";

export type Konum = "sag-alt" | "orta-alt" | "sol-alt" | "sag-ust" | "orta-ust" | "sol-ust";
/** son: son sayfa · ilk: ilk sayfa · hepsi: her sayfa · sec: yalnız yazılanlar · haric: yazılanlar HARİÇ hepsi */
export type SayfaModu = "son" | "ilk" | "hepsi" | "sec" | "haric";

export type ImzaTercihi = {
  mod: SayfaModu;
  /** "1,3,5-7" biçiminde; yalnızca sec/haric kipinde anlamlı. */
  sayfalar: string;
  konum: Konum;
};

export const VARSAYILAN_TERCIH: ImzaTercihi = { mod: "son", sayfalar: "", konum: "sag-alt" };

const KONUMLAR: Konum[] = ["sag-alt", "orta-alt", "sol-alt", "sag-ust", "orta-ust", "sol-ust"];
const MODLAR: SayfaModu[] = ["son", "ilk", "hepsi", "sec", "haric"];

/** Dışarıdan gelen değeri güvenli bir tercihe çevirir; bozuksa varsayılana düşer. */
export function tercihiCoz(ham: unknown): ImzaTercihi {
  let obj: unknown = ham;
  if (typeof ham === "string") {
    if (!ham.trim()) return { ...VARSAYILAN_TERCIH };
    try {
      obj = JSON.parse(ham);
    } catch {
      throw new HttpError(400, "İmza yeri tercihi okunamadı.");
    }
  }
  if (!obj || typeof obj !== "object") return { ...VARSAYILAN_TERCIH };
  const o = obj as Record<string, unknown>;
  const mod = MODLAR.includes(o.mod as SayfaModu) ? (o.mod as SayfaModu) : "son";
  const konum = KONUMLAR.includes(o.konum as Konum) ? (o.konum as Konum) : "sag-alt";
  const sayfalar = typeof o.sayfalar === "string" ? o.sayfalar.slice(0, 200) : "";
  return { mod, sayfalar, konum };
}

function listeyiAyir(metin: string, toplam: number): Set<number> {
  const out = new Set<number>();
  for (const parca of metin.split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(parca);
    if (!m) throw new HttpError(400, `Sayfa listesi anlaşılamadı: «${parca}». Örnek: 1, 3, 5-7`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a || b > toplam) {
      throw new HttpError(400, `Belgede ${toplam} sayfa var; «${parca}» geçersiz.`);
    }
    for (let i = a; i <= b; i++) out.add(i);
  }
  return out;
}

/** İmzanın konacağı sayfalar (1'den başlar, sıralı). Boş sonuç hata sayılır. */
export function sayfalariCoz(t: ImzaTercihi, toplam: number): number[] {
  let sonuc: number[];
  switch (t.mod) {
    case "ilk":
      sonuc = [1];
      break;
    case "hepsi":
      sonuc = Array.from({ length: toplam }, (_, i) => i + 1);
      break;
    case "sec":
      sonuc = [...listeyiAyir(t.sayfalar, toplam)];
      break;
    case "haric": {
      const haric = listeyiAyir(t.sayfalar, toplam);
      sonuc = Array.from({ length: toplam }, (_, i) => i + 1).filter((n) => !haric.has(n));
      break;
    }
    default:
      sonuc = [toplam];
  }
  sonuc.sort((a, b) => a - b);
  if (sonuc.length === 0) {
    throw new HttpError(400, "İmza için en az bir sayfa seçili olmalı.");
  }
  return sonuc;
}

const KONUM_ADI: Record<Konum, string> = {
  "sag-alt": "sağ alt köşesine",
  "orta-alt": "alt ortasına",
  "sol-alt": "sol alt köşesine",
  "sag-ust": "sağ üst köşesine",
  "orta-ust": "üst ortasına",
  "sol-ust": "sol üst köşesine",
};

/** İmzalayana ve gönderene gösterilen tek cümlelik özet. */
export function tercihOzeti(t: ImzaTercihi): string {
  const konum = KONUM_ADI[t.konum];
  switch (t.mod) {
    case "ilk":
      return `İmzanız belgenin ilk sayfasının ${konum} eklenecek.`;
    case "hepsi":
      return `İmzanız belgenin her sayfasının ${konum} eklenecek.`;
    case "sec":
      return `İmzanız ${t.sayfalar.trim()} numaralı sayfaların ${konum} eklenecek.`;
    case "haric":
      return `İmzanız, ${t.sayfalar.trim()} numaralı sayfalar dışındaki tüm sayfaların ${konum} eklenecek.`;
    default:
      return `İmzanız belgenin son sayfasının ${konum} eklenecek.`;
  }
}
