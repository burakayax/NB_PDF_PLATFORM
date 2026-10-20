/**
 * Yer imlerini (bookmark / içindekiler) kaynak belgeden yeni belgeye taşır.
 *
 * NEDEN: pdf-lib `copyPages` yalnızca sayfaları kopyalar; yer imleri sayfa değil belge
 * düzeyindedir ve kaybolur. Böl / Sırala / Sayfa Sil çıktıda yer imi yitiriyor, Döndür
 * ise aynı belgeyi güncellediği için koruyordu (tutarsızlık). Burada yer imi ağacı okunur,
 * yalnızca çıktıda kalan sayfalara işaret edenler yeni sayfa numaralarıyla yeniden yazılır.
 *
 * Yer imi taşınamazsa işlem ASLA bozulmaz: her hata yutulur, çıktı yer imsiz kalır.
 */
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString } from "pdf-lib";

type OutlineNode = {
  title: PDFString | PDFHexString;
  /** Kaynaktaki 0 tabanlı sayfa; çözülemezse null. */
  page: number | null;
  children: OutlineNode[];
};

const MAKS_DUGUM = 5000;
const MAKS_DERINLIK = 12;

function hedefSayfa(src: PDFDocument, item: PDFDict, sayfaIdx: Map<string, number>): number | null {
  let dest = item.lookup(PDFName.of("Dest"));
  if (!dest) {
    const action = item.lookup(PDFName.of("A"));
    if (action instanceof PDFDict) dest = action.lookup(PDFName.of("D"));
  }
  if (dest instanceof PDFArray) {
    const ilk = dest.get(0);
    if (ilk instanceof PDFRef) return sayfaIdx.get(ilk.toString()) ?? null;
  }
  // Adlandırılmış hedefler (metin) çözülmez: o yer imi sayfasız sayılır.
  void src;
  return null;
}

function seviyeyiOku(
  src: PDFDocument,
  ilk: unknown,
  sayfaIdx: Map<string, number>,
  derinlik: number,
  butce: { kalan: number },
): OutlineNode[] {
  const dugumler: OutlineNode[] = [];
  const gorulen = new Set<string>();
  let cur = ilk;
  while (cur instanceof PDFRef && !gorulen.has(cur.toString()) && butce.kalan-- > 0) {
    gorulen.add(cur.toString());
    const d = src.context.lookup(cur, PDFDict);
    if (!d) break;
    const baslik = d.lookup(PDFName.of("Title"));
    const cocuklar =
      derinlik < MAKS_DERINLIK ? seviyeyiOku(src, d.get(PDFName.of("First")), sayfaIdx, derinlik + 1, butce) : [];
    if (baslik instanceof PDFString || baslik instanceof PDFHexString) {
      dugumler.push({ title: baslik, page: hedefSayfa(src, d, sayfaIdx), children: cocuklar });
    }
    cur = d.get(PDFName.of("Next"));
  }
  return dugumler;
}

type KalanDugum = { title: PDFString | PDFHexString; yeniSayfa: number; children: KalanDugum[] };

/** Yalnızca çıktıda kalan sayfalara işaret edenleri tutar; sayfası gidenin kalan çocuğu varsa onun sayfasına bağlanır. */
function suz(dugumler: OutlineNode[], eskiyeniye: Map<number, number>): KalanDugum[] {
  const sonuc: KalanDugum[] = [];
  for (const n of dugumler) {
    const cocuk = suz(n.children, eskiyeniye);
    const kendi = n.page !== null ? eskiyeniye.get(n.page) : undefined;
    const sayfa = kendi ?? cocuk[0]?.yeniSayfa;
    if (sayfa === undefined) continue;
    sonuc.push({ title: n.title, yeniSayfa: sayfa, children: cocuk });
  }
  return sonuc;
}

function torunSayisi(n: KalanDugum): number {
  return n.children.reduce((t, c) => t + 1 + torunSayisi(c), 0);
}

function seviyeyiYaz(
  out: PDFDocument,
  dugumler: KalanDugum[],
  ebeveyn: PDFRef,
  sayfaRefleri: PDFRef[],
): { first: PDFRef; last: PDFRef; count: number } | null {
  if (dugumler.length === 0) return null;
  const refler = dugumler.map(() => out.context.nextRef());
  let toplam = 0;
  dugumler.forEach((n, i) => {
    const alanlar: Record<string, unknown> = {
      Title: n.title,
      Parent: ebeveyn,
      Dest: [sayfaRefleri[n.yeniSayfa]!, PDFName.of("Fit")],
    };
    if (i > 0) alanlar.Prev = refler[i - 1]!;
    if (i < dugumler.length - 1) alanlar.Next = refler[i + 1]!;
    const alt = seviyeyiYaz(out, n.children, refler[i]!, sayfaRefleri);
    if (alt) {
      alanlar.First = alt.first;
      alanlar.Last = alt.last;
      alanlar.Count = torunSayisi(n);
    }
    out.context.assign(refler[i]!, out.context.obj(alanlar as never));
    toplam += 1 + torunSayisi(n);
  });
  return { first: refler[0]!, last: refler[refler.length - 1]!, count: toplam };
}

/**
 * `src`'deki yer imlerini `out`'a taşır. `kaynakSayfalar[k]` = çıktının k'ıncı sayfasının
 * kaynaktaki (0 tabanlı) sayfa numarası. Çıktının sayfaları bu işlemden ÖNCE eklenmiş olmalı.
 */
export function yerImleriniAktar(src: PDFDocument, out: PDFDocument, kaynakSayfalar: number[]): void {
  try {
    const kok = src.catalog.lookup(PDFName.of("Outlines"));
    if (!(kok instanceof PDFDict)) return;

    const sayfaIdx = new Map<string, number>();
    src.getPages().forEach((p, i) => sayfaIdx.set(p.ref.toString(), i));

    const agac = seviyeyiOku(src, kok.get(PDFName.of("First")), sayfaIdx, 0, { kalan: MAKS_DUGUM });
    if (agac.length === 0) return;

    // Aynı kaynak sayfa birden çok kez varsa ilk görünümüne bağlanır.
    const eskiyeniye = new Map<number, number>();
    kaynakSayfalar.forEach((eski, yeni) => {
      if (!eskiyeniye.has(eski)) eskiyeniye.set(eski, yeni);
    });
    const kalan = suz(agac, eskiyeniye);
    if (kalan.length === 0) return;

    const cikisSayfalari = out.getPages().map((p) => p.ref);
    const kokRef = out.context.nextRef();
    const yazilan = seviyeyiYaz(out, kalan, kokRef, cikisSayfalari);
    if (!yazilan) return;
    out.context.assign(
      kokRef,
      out.context.obj({
        Type: "Outlines",
        First: yazilan.first,
        Last: yazilan.last,
        Count: yazilan.count,
      }),
    );
    out.catalog.set(PDFName.of("Outlines"), kokRef);
  } catch {
    // Yer imi taşınamazsa çıktı yine geçerli; işlemi bozmaya değmez.
  }
}
