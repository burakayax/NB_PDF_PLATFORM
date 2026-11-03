/**
 * PDF → bloklar (başlık/paragraf/madde), ve bloklar → Markdown / EPUB. Hepsi cihazda.
 *
 * Başlık tespiti: gövde yazı boyutu (en çok metnin yazıldığı boyut) bulunur; ondan belirgin büyük ve kısa
 * paragraflar başlıktır (en büyük boyut #, sonrakiler ##/###). Sayfa numarası ve her sayfada tekrar eden
 * üst/alt bilgi satırları atılır. Taranmış (metinsiz) PDF'te ScannedPdfError fırlatılır.
 */
import { zipSync, strToU8 } from "fflate";
import type { Block, Run } from "./docText";
import { itemsToParagraphsH, ScannedPdfError, type TextItem } from "./pdfToUdf";

export type PdfPara = { text: string; h: number };

const BULLET_RE = /^[•●▪◦‣■□▫·]\s*/;
const DASH_BULLET_RE = /^[-–—*]\s+/;
const NUM_RE = /^(\d{1,3}[.)])\s+/;

const normKey = (t: string) => t.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

/** Sayfa başına paragrafları bloklara çevirir (başlık, madde, paragraf). Saf fonksiyon. */
export function pagesToBlocks(pages: PdfPara[][]): Block[] {
  // Tekrar eden üst/alt bilgi + yalnız sayfa numarası olan satırları ele.
  const counts = new Map<string, number>();
  pages.forEach((ps) => {
    const edge = new Set<string>();
    if (ps[0]) edge.add(normKey(ps[0].text));
    if (ps.length > 1) edge.add(normKey(ps[ps.length - 1].text));
    edge.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
  });
  const repeated = (k: string) => pages.length >= 3 && (counts.get(k) ?? 0) >= Math.max(3, Math.ceil(pages.length * 0.4));
  const filtered = pages.map((ps) =>
    ps.filter((p, i) => {
      const edge = i === 0 || i === ps.length - 1;
      if (!edge) return true;
      if (/^\s*(sayfa|page)?\s*\d{1,4}(\s*\/\s*\d{1,4})?\s*$/i.test(p.text)) return false;
      return !repeated(normKey(p.text));
    }),
  );

  // Gövde boyutu: en çok karakterin yazıldığı yükseklik (0,5 pt yuvarlama).
  const weight = new Map<number, number>();
  for (const ps of filtered) for (const p of ps) {
    const k = Math.round(p.h * 2) / 2;
    weight.set(k, (weight.get(k) ?? 0) + p.text.length);
  }
  let body = 10;
  let best = -1;
  for (const [k, w] of weight) if (w > best) { best = w; body = k; }

  const sizes = [...new Set(filtered.flat().filter((p) => p.h >= body * 1.18 && p.text.length <= 140).map((p) => Math.round(p.h * 2) / 2))].sort((a, b) => b - a);
  const levelOf = (h: number): 1 | 2 | 3 => {
    const idx = sizes.indexOf(Math.round(h * 2) / 2);
    return (Math.min(idx < 0 ? 2 : idx, 2) + 1) as 1 | 2 | 3;
  };

  const out: Block[] = [];
  for (const ps of filtered) {
    for (const p of ps) {
      const text = p.text.replace(/\s+/g, " ").trim();
      if (!text) continue;
      if (p.h >= body * 1.18 && text.length <= 140) {
        out.push({ k: "h", level: levelOf(p.h), text });
        continue;
      }
      let m: RegExpExecArray | null;
      if ((m = BULLET_RE.exec(text))) out.push({ k: "p", runs: [{ t: text.slice(m[0].length) }], bullet: "•", indent: 1 });
      else if ((m = DASH_BULLET_RE.exec(text))) out.push({ k: "p", runs: [{ t: text.slice(m[0].length) }], bullet: "•", indent: 1 });
      else if ((m = NUM_RE.exec(text))) out.push({ k: "p", runs: [{ t: text.slice(m[0].length) }], bullet: m[1], indent: 1 });
      else out.push({ k: "p", runs: [{ t: text }] });
    }
  }
  return out;
}

/** PDF dosyasından bloklar (pdf.js yalnızca bu araç çalışırken yüklenir). */
export async function pdfToBlocks(file: File): Promise<Block[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pages: PdfPara[][] = [];
  let chars = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of content.items) {
      const t = it as { str?: string; transform?: number[]; width?: number; height?: number };
      if (typeof t.str !== "string" || !t.transform) continue;
      items.push({ str: t.str, x: t.transform[4] ?? 0, y: t.transform[5] ?? 0, w: t.width ?? 0, h: t.height || Math.abs(t.transform[3] ?? 10) });
    }
    const paras = itemsToParagraphsH(items);
    chars += paras.reduce((s, p) => s + p.text.length, 0);
    pages.push(paras);
  }
  if (chars < 20) throw new ScannedPdfError();
  return pagesToBlocks(pages);
}

// ── Markdown ───────────────────────────────────────────────────────

const mdEscape = (s: string) => s.replace(/([\\`*_{}[\]<>])/g, "\\$1").replace(/^(\s*)([#>+-]|\d+[.)])(\s)/, "$1\\$2$3");
const runsMd = (runs: Run[]) => runs.map((r) => (r.b && r.t.trim() ? `**${mdEscape(r.t.trim())}**` : mdEscape(r.t))).join("").replace(/\*\*\s*\*\*/g, "");

/** Bloklar → Markdown metni. */
export function blocksToMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  let prevList = false;
  for (const b of blocks) {
    const list = b.k === "p" && !!b.bullet;
    if (!(prevList && list) && out.length) out.push("");
    prevList = list;
    switch (b.k) {
      case "h": out.push(`${"#".repeat(b.level)} ${mdEscape(b.text)}`); break;
      case "p": out.push(b.bullet ? `${"  ".repeat(Math.max(0, (b.indent ?? 1) - 1))}${/\d/.test(b.bullet) ? b.bullet : "-"} ${runsMd(b.runs)}` : runsMd(b.runs)); break;
      case "lines": out.push(b.lines.map((l) => mdEscape(l)).join("  \n")); break;
      case "code": out.push("```", b.text, "```"); break;
      case "quote": out.push(`> ${runsMd(b.runs)}`); break;
      case "hr": out.push("---"); break;
      case "break": out.push("---"); break;
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ── EPUB ───────────────────────────────────────────────────────────

export const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const runsHtml = (runs: Run[]) => runs.map((r) => (r.b ? `<strong>${xmlEsc(r.t)}</strong>` : xmlEsc(r.t))).join("");

function blockHtml(b: Block, openList: { v: boolean }): string {
  const closeList = () => (openList.v ? ((openList.v = false), "</ul>") : "");
  if (b.k === "p" && b.bullet) {
    const pre = openList.v ? "" : ((openList.v = true), "<ul>");
    return `${pre}<li>${runsHtml(b.runs)}</li>`;
  }
  const c = closeList();
  switch (b.k) {
    case "h": return `${c}<h${b.level}>${xmlEsc(b.text)}</h${b.level}>`;
    case "p": return `${c}<p>${runsHtml(b.runs)}</p>`;
    case "lines": return `${c}<p>${b.lines.map(xmlEsc).join("<br/>")}</p>`;
    case "code": return `${c}<pre>${xmlEsc(b.text)}</pre>`;
    case "quote": return `${c}<blockquote><p>${runsHtml(b.runs)}</p></blockquote>`;
    case "hr": return `${c}<hr/>`;
    case "break": return c;
  }
}

const CSS = `body{font-family:serif;line-height:1.55;margin:1em}h1,h2,h3{font-family:sans-serif;line-height:1.25}p{margin:.6em 0;text-align:justify}pre{background:#f3f3f6;padding:.6em;white-space:pre-wrap;font-size:.85em}blockquote{border-left:3px solid #6d28d9;margin:.8em 0;padding-left:.8em;color:#444}hr{border:0;border-top:1px solid #ccc}`;

/** Bloklar → EPUB 3 (başlık/bölüm kırılımı, içindekiler, Türkçe karakterli UTF-8). */
export function blocksToEpub(blocks: Block[], opts: { title: string; lang: "tr" | "en"; id?: string }): Uint8Array {
  // Bölümler: her h1 yeni bölüm; h1 yoksa 40 blokluk dilimler.
  const chapters: { title: string; blocks: Block[] }[] = [];
  const hasH1 = blocks.some((b) => b.k === "h" && b.level === 1);
  const dflt = opts.lang === "tr" ? "Bölüm" : "Chapter";
  let cur: { title: string; blocks: Block[] } | null = null;
  blocks.forEach((b, i) => {
    const startNew = hasH1 ? b.k === "h" && b.level === 1 : i % 40 === 0;
    if (!cur || startNew) {
      cur = { title: b.k === "h" ? b.text : `${dflt} ${chapters.length + 1}`, blocks: [] };
      chapters.push(cur);
    }
    if (b.k !== "break" || !hasH1) cur.blocks.push(b);
  });
  if (!chapters.length) chapters.push({ title: opts.title, blocks: [] });

  const uid = opts.id ?? `urn:uuid:${crypto.randomUUID?.() ?? `${Date.now()}-nb-pdf-platform`}`;
  const head = `<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${opts.lang}" xml:lang="${opts.lang}">`;
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
    "OEBPS/style.css": strToU8(CSS),
  };
  chapters.forEach((ch, i) => {
    const open = { v: false };
    const inner = ch.blocks.map((b) => blockHtml(b, open)).join("\n") + (open.v ? "</ul>" : "");
    files[`OEBPS/ch${i + 1}.xhtml`] = strToU8(`${head}<head><meta charset="utf-8"/><title>${xmlEsc(ch.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>\n${inner}\n</body></html>`);
  });
  files["OEBPS/nav.xhtml"] = strToU8(
    `${head}<head><meta charset="utf-8"/><title>${xmlEsc(opts.title)}</title></head><body><nav epub:type="toc" id="toc"><h1>${opts.lang === "tr" ? "İçindekiler" : "Contents"}</h1><ol>${chapters.map((c, i) => `<li><a href="ch${i + 1}.xhtml">${xmlEsc(c.title)}</a></li>`).join("")}</ol></nav></body></html>`,
  );
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  files["OEBPS/content.opf"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${xmlEsc(uid)}</dc:identifier><dc:title>${xmlEsc(opts.title)}</dc:title><dc:language>${opts.lang}</dc:language><meta property="dcterms:modified">${modified}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${chapters.map((_, i) => `<item id="c${i + 1}" href="ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("")}</manifest><spine>${chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join("")}</spine></package>`,
  );
  return zipSync(files);
}
