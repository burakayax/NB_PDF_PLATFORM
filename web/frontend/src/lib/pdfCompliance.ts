/**
 * E-başvuru / kurum yükleme UYUMLULUK KONTROLÜ — tamamen cihazda.
 *
 * SABİT "UYAP SINIRI" YOKTUR: her kurumun kuralı farklıdır ve değişir. Sınırları
 * kullanıcı kendisi seçer; araç yalnızca PDF'nin o sınırlara uyup uymadığını söyler
 * ve düzeltilebilenleri düzeltir.
 */

export type PdfFacts = {
  bytes: number;
  pages: number;
  encrypted: boolean;
  /** Sayfa boyutları (pt, dönüklük uygulanmış). */
  pageSizes: { w: number; h: number }[];
  /** İlk sayfalarda seçilebilir metin var mı. */
  hasText: boolean;
};

export type Limits = {
  /** Bayt cinsinden en fazla dosya boyutu; yoksa denetlenmez. */
  maxBytes?: number;
  maxPages?: number;
  a4Only: boolean;
  requireText: boolean;
};

export type CheckId = "encrypted" | "size" | "pages" | "a4" | "text";
export type Check = {
  id: CheckId;
  status: "ok" | "fail";
  /** "Düzelt" ile giderilebilir mi. */
  fixable: boolean;
  tr: string;
  en: string;
};

export const A4_W = 595.28;
export const A4_H = 841.89;
const A4_TOL = 6;

export function isA4(w: number, h: number): boolean {
  const near = (a: number, b: number) => Math.abs(a - b) <= A4_TOL;
  return (near(w, A4_W) && near(h, A4_H)) || (near(w, A4_H) && near(h, A4_W));
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function evaluate(f: PdfFacts, l: Limits): Check[] {
  const out: Check[] = [];
  if (f.encrypted) {
    out.push({
      id: "encrypted",
      status: "fail",
      fixable: false,
      tr: "Dosya şifreli; içeriği okunamadı. Önce «PDF Şifre Kaldır» aracını kullanın.",
      en: "The file is password-protected, so it could not be inspected. Remove the password first.",
    });
    return out;
  }
  if (l.maxBytes !== undefined) {
    const ok = f.bytes <= l.maxBytes;
    out.push({
      id: "size",
      status: ok ? "ok" : "fail",
      fixable: !ok,
      tr: ok
        ? `Boyut uygun: ${formatBytes(f.bytes)} (sınır ${formatBytes(l.maxBytes)}).`
        : `Dosya çok büyük: ${formatBytes(f.bytes)} (sınır ${formatBytes(l.maxBytes)}).`,
      en: ok
        ? `Size is fine: ${formatBytes(f.bytes)} (limit ${formatBytes(l.maxBytes)}).`
        : `File is too large: ${formatBytes(f.bytes)} (limit ${formatBytes(l.maxBytes)}).`,
    });
  }
  if (l.maxPages !== undefined) {
    const ok = f.pages <= l.maxPages;
    out.push({
      id: "pages",
      status: ok ? "ok" : "fail",
      fixable: false,
      tr: ok
        ? `Sayfa sayısı uygun: ${f.pages} (sınır ${l.maxPages}).`
        : `Sayfa sayısı fazla: ${f.pages} (sınır ${l.maxPages}). «PDF Böl» aracıyla parçalara ayırabilirsiniz.`,
      en: ok
        ? `Page count is fine: ${f.pages} (limit ${l.maxPages}).`
        : `Too many pages: ${f.pages} (limit ${l.maxPages}). Split the PDF into parts.`,
    });
  }
  if (l.a4Only) {
    const bad = f.pageSizes.map((s, i) => ({ s, i })).filter(({ s }) => !isA4(s.w, s.h));
    const ok = bad.length === 0;
    out.push({
      id: "a4",
      status: ok ? "ok" : "fail",
      fixable: !ok,
      tr: ok
        ? "Tüm sayfalar A4."
        : `${bad.length} sayfa A4 değil (ilk: sayfa ${bad[0]!.i + 1}).`,
      en: ok ? "All pages are A4." : `${bad.length} page(s) are not A4 (first: page ${bad[0]!.i + 1}).`,
    });
  }
  if (l.requireText) {
    out.push({
      id: "text",
      status: f.hasText ? "ok" : "fail",
      fixable: false,
      tr: f.hasText
        ? "Seçilebilir metin var."
        : "Seçilebilir metin yok (taranmış görünüyor). «Taranmış PDF (OCR)» aracıyla aranabilir yapın.",
      en: f.hasText ? "Selectable text found." : "No selectable text (looks scanned). Run OCR to make it searchable.",
    });
  }
  return out;
}

export const allPass = (checks: Check[]) => checks.every((c) => c.status === "ok");
