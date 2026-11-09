/**
 * İSTEK NOTU — kalın / italik / altı çizili / punto / sabit renk.
 *
 * Not, gönderenin tarayıcısındaki bir düzenleyiciden HTML olarak gelir ve hem
 * e-postaya hem imzalayanın sayfasına basılır. Kullanıcı girdisi olduğu için
 * HİÇBİR ZAMAN olduğu gibi basılmaz: burada yalnızca izin verilen etiketler ve
 * özellikler yeniden kurulur, geri kalan her şey metne çevrilir (XSS ve e-posta
 * düzenini bozma riskine karşı beyaz liste).
 */
import { escapeHtml } from "../../lib/email-html.js";

export const NOT_EN_COK_KARAKTER = 1000;

const BOYUT: Record<string, number> = { "1": 11, "2": 13, "3": 15, "4": 17, "5": 20, "6": 24, "7": 30 };

function renk(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^#[0-9a-f]{3}$/.test(t)) return "#" + t.slice(1).split("").map((h) => h + h).join("");
  const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(t);
  if (m) {
    const h = (n: string) => Math.min(255, Number(n)).toString(16).padStart(2, "0");
    return `#${h(m[1]!)}${h(m[2]!)}${h(m[3]!)}`;
  }
  return null;
}

function nitelikler(etiket: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(etiket))) out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? "";
  return out;
}

/** Güvenli stil dizesi (yalnız renk, punto, kalın, italik, altı çizili). */
function stilKur(opts: { color?: string | null; px?: number | null; bold?: boolean; italic?: boolean; underline?: boolean }): string {
  const p: string[] = [];
  if (opts.color) p.push(`color:${opts.color}`);
  if (opts.px) p.push(`font-size:${opts.px}px`);
  if (opts.bold) p.push("font-weight:700");
  if (opts.italic) p.push("font-style:italic");
  if (opts.underline) p.push("text-decoration:underline");
  return p.join(";");
}

function stilCoz(stil: string): { color: string | null; px: number | null; bold: boolean; italic: boolean; underline: boolean } {
  const r = { color: null as string | null, px: null as number | null, bold: false, italic: false, underline: false };
  for (const parca of stil.split(";")) {
    const [k, ...v] = parca.split(":");
    const ad = (k ?? "").trim().toLowerCase();
    const deger = v.join(":").trim().toLowerCase();
    if (ad === "color") r.color = renk(deger);
    else if (ad === "font-size") {
      const m = /^(\d{1,2}(?:\.\d+)?)px$/.exec(deger);
      if (m) r.px = Math.max(10, Math.min(36, Math.round(Number(m[1]))));
    } else if (ad === "font-weight") r.bold = deger === "bold" || Number(deger) >= 600;
    else if (ad === "font-style") r.italic = deger === "italic";
    else if (ad === "text-decoration" || ad === "text-decoration-line") r.underline = deger.includes("underline");
  }
  return r;
}

function metniTemizle(t: string): string {
  return t.replace(/&(?!(?:amp|lt|gt|quot|nbsp|#\d{1,6}|#x[0-9a-f]{1,6});)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Kullanıcı HTML'ini beyaz listeyle temizler. Düz metin (etiketsiz) gelirse satır sonları korunur. */
export function temizNot(ham: string | null | undefined): string {
  const s = String(ham ?? "")
    .slice(0, 8000)
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*(?:script|style)\s*>/gi, "");
  if (!/<[a-zA-Z/]/.test(s)) {
    return escapeHtml(s.trim()).replace(/\r?\n/g, "<br />");
  }
  const acik: string[] = [];
  let cikti = "";
  for (const parca of s.split(/(<[^>]*>)/)) {
    if (!parca) continue;
    if (!parca.startsWith("<") || !parca.endsWith(">")) {
      cikti += metniTemizle(parca);
      continue;
    }
    const kapanis = /^<\s*\/\s*([a-zA-Z0-9]+)/.exec(parca);
    if (kapanis) {
      const ad = kapanis[1]!.toLowerCase();
      const harita = ad === "font" ? "span" : ad === "strong" ? "b" : ad === "em" ? "i" : ad;
      if (acik.length && acik[acik.length - 1] === harita) {
        acik.pop();
        cikti += `</${harita}>`;
      }
      continue;
    }
    const ac = /^<\s*([a-zA-Z0-9]+)/.exec(parca);
    if (!ac) continue;
    const ad = ac[1]!.toLowerCase();
    const n = nitelikler(parca);
    if (ad === "br") {
      cikti += "<br />";
    } else if (ad === "b" || ad === "strong") {
      acik.push("b");
      cikti += "<b>";
    } else if (ad === "i" || ad === "em") {
      acik.push("i");
      cikti += "<i>";
    } else if (ad === "u") {
      acik.push("u");
      cikti += "<u>";
    } else if (ad === "div" || ad === "p") {
      acik.push(ad);
      cikti += `<${ad}>`;
    } else if (ad === "font" || ad === "span") {
      const st = ad === "span" ? stilCoz(n.style ?? "") : { color: null, px: null, bold: false, italic: false, underline: false };
      const color = ad === "font" ? renk(n.color) : st.color;
      const px = ad === "font" ? (n.size ? BOYUT[n.size] ?? null : null) : st.px;
      const stil = stilKur({ color, px, bold: st.bold, italic: st.italic, underline: st.underline });
      acik.push("span");
      cikti += stil ? `<span style="${stil}">` : "<span>";
    }
    // diğer tüm etiketler (script, img, a, style, ...) atılır; içindeki metin korunur
  }
  while (acik.length) cikti += `</${acik.pop()}>`;
  return cikti.trim();
}

/** Biçimsiz düz metin karşılığı (e-posta metin kısmı ve karakter sayımı için). */
export function notDuzMetin(html: string | null | undefined): string {
  return String(html ?? "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(div|p)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .trim();
}
