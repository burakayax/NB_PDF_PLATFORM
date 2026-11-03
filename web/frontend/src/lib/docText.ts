/**
 * Belge okuyucular: TXT, Markdown, RTF, ODT, EPUB → ortak "blok" listesi (başlık, paragraf, madde, kod, çizgi).
 * Hepsi cihazda çalışır. Çıktı blocksPdf.ts ile PDF'e, ya da docExport.ts ile Markdown/EPUB'a çevrilir.
 * Türkçe karakterler: TXT'de UTF-8 yoksa Windows-1254 denenir; RTF'de \'hh kod sayfasıyla çözülür.
 */
import { unzipSync, strFromU8 } from "fflate";

export type Run = { t: string; b?: boolean };
export type Block =
  | { k: "h"; level: 1 | 2 | 3; text: string }
  | { k: "p"; runs: Run[]; bullet?: string; indent?: number }
  /** Satırları korunan metin (şiir, günlük, TXT paragrafı): her satır ayrı sarılır. */
  | { k: "lines"; lines: string[] }
  | { k: "code"; text: string }
  | { k: "quote"; runs: Run[] }
  | { k: "hr" }
  | { k: "break" };

export class DocReadError extends Error {
  constructor(message: string, readonly code: "empty" | "invalid") {
    super(message);
    this.name = "DocReadError";
  }
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const plain = (t: string): Run[] => (t ? [{ t }] : []);

/** TXT baytlarını metne çevirir: BOM'a bakar, UTF-8 olmazsa Windows-1254 (Türkçe ANSI) kullanır. */
export function decodeText(buf: Uint8Array): string {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return new TextDecoder("utf-8").decode(buf.subarray(3));
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1254").decode(buf);
  }
}

/** Düz metin: boş satırlarla ayrılan her küme bir "lines" bloğu olur (satır kırılımları korunur). */
export function txtToBlocks(text: string): Block[] {
  const out: Block[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) out.push({ k: "lines", lines: cur });
    cur = [];
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (raw.trim() === "") flush();
    else cur.push(raw.replace(/\s+$/, ""));
  }
  flush();
  return out;
}

/** Satır içi Markdown: **kalın**; bağlantı/görsel/kod/italik işaretleri sadeleştirilir. */
export function inlineMd(src: string): Run[] {
  let s = src
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_m, t: string, u: string) => (t === u ? t : `${t} (${u})`))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "");
  s = s.replace(/(^|[^*_\w])[*_]([^*_\s][^*_]*)[*_](?![*_\w])/g, "$1$2");
  const runs: Run[] = [];
  for (const part of s.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)) {
    if (!part) continue;
    if (/^(\*\*|__)[\s\S]+(\*\*|__)$/.test(part)) runs.push({ t: part.slice(2, -2), b: true });
    else runs.push({ t: part });
  }
  return runs;
}

/** Markdown → bloklar (başlık, liste, alıntı, kod çiti, tablo satırı, yatay çizgi). */
export function mdToBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ k: "p", runs: inlineMd(para.join(" ")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      out.push({ k: "code", text: body.join("\n") });
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { flush(); out.push({ k: "h", level: Math.min(3, h[1].length) as 1 | 2 | 3, text: collapse(inlineMd(h[2]).map((r) => r.t).join("")) }); continue; }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push({ k: "hr" }); continue; }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const bullet = /\d/.test(li[2]) ? li[2] : "•";
      out.push({ k: "p", runs: inlineMd(li[3]), bullet, indent: Math.min(3, Math.floor(li[1].replace(/\t/g, "  ").length / 2)) + 1 });
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const q: string[] = [line.replace(/^\s*>\s?/, "")];
      while (i + 1 < lines.length && /^\s*>/.test(lines[i + 1])) q.push(lines[++i].replace(/^\s*>\s?/, ""));
      out.push({ k: "quote", runs: inlineMd(q.join(" ")) });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => collapse(inlineMd(c).map((r) => r.t).join("")));
      out.push({ k: "p", runs: plain(cells.join("   |   ")) });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out;
}

// ── RTF ────────────────────────────────────────────────────────────

const RTF_SKIP = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "header", "footer", "headerl", "headerr", "headerf", "footerl", "footerr", "footerf",
  "footnote", "object", "themedata", "colorschememapping", "latentstyles", "datastore", "listtable", "listoverridetable", "rsidtbl",
  "generator", "xmlnstbl", "private", "wgrffmtfilter", "fldinst", "bkmkstart", "bkmkend", "revtbl", "pgptbl", "mmathPr",
]);
const RTF_CHARS: Record<string, string> = {
  emdash: "—", endash: "–", lquote: "‘", rquote: "’", ldblquote: "“", rdblquote: "”", bullet: "•", tab: "    ", emspace: " ", enspace: " ",
  zwj: "", zwnj: "", "~": " ", _: "-", "-": "",
};

/** RTF → bloklar: metin, kalın, paragraf; Türkçe karakterler kod sayfasına göre çözülür. */
export function rtfToBlocks(rtf: string): Block[] {
  if (!/^\s*\{\\rtf/i.test(rtf)) throw new DocReadError("RTF değil", "invalid");
  const cp = /\\ansicpg(\d+)/.exec(rtf)?.[1] ?? "1252";
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(`windows-${cp}`);
  } catch {
    decoder = new TextDecoder("windows-1252");
  }
  type St = { skip: boolean; bold: boolean; uc: number };
  const stack: St[] = [];
  let st: St = { skip: false, bold: false, uc: 1 };
  let skipChars = 0;
  const paras: Run[][] = [];
  let cur: Run[] = [];
  let bytes: number[] = [];
  const put = (s: string) => {
    if (st.skip || !s) return;
    const last = cur[cur.length - 1];
    if (last && !!last.b === st.bold) last.t += s;
    else cur.push({ t: s, ...(st.bold ? { b: true } : {}) });
  };
  const flushBytes = () => {
    if (bytes.length) put(decoder.decode(Uint8Array.from(bytes)));
    bytes = [];
  };
  const endPara = () => {
    flushBytes();
    paras.push(cur);
    cur = [];
  };

  let i = 0;
  const n = rtf.length;
  while (i < n) {
    const ch = rtf[i];
    if (ch === "{") {
      flushBytes();
      stack.push({ ...st });
      i++;
      // Hedef (destination) grubu: {\*\xxx ...} ya da bilinen gizli gruplar atlanır.
      if (rtf.startsWith("\\*", i)) st.skip = true;
      else {
        const m = /^\\([a-zA-Z]+)/.exec(rtf.slice(i, i + 24));
        if (m && RTF_SKIP.has(m[1])) st.skip = true;
      }
      continue;
    }
    if (ch === "}") {
      flushBytes();
      st = stack.pop() ?? st;
      i++;
      continue;
    }
    if (ch === "\\") {
      const next = rtf[i + 1];
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        i += 4;
        if (skipChars > 0) { skipChars--; continue; }
        if (!st.skip) bytes.push(parseInt(hex, 16) || 63);
        continue;
      }
      flushBytes();
      if (next === "\\" || next === "{" || next === "}") {
        i += 2;
        if (skipChars > 0) skipChars--;
        else put(next);
        continue;
      }
      if (next === "~" || next === "_" || next === "-") { put(RTF_CHARS[next]); i += 2; continue; }
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i, i + 40));
      if (!m) { i += 2; continue; }
      i += m[0].length;
      const word = m[1];
      const num = m[2] !== undefined ? parseInt(m[2], 10) : undefined;
      if (word === "par" || word === "sect") endPara();
      else if (word === "line") put(" ");
      else if (word === "b") st.bold = num !== 0;
      else if (word === "uc") st.uc = num ?? 1;
      else if (word === "u" && num !== undefined) {
        if (!st.skip) put(String.fromCharCode(num < 0 ? num + 65536 : num));
        skipChars = st.uc;
      } else if (word in RTF_CHARS) put(RTF_CHARS[word]);
      else if (word === "pard" || word === "plain") { if (word === "plain") st.bold = false; }
      continue;
    }
    if (ch === "\n" || ch === "\r") { i++; continue; }
    // Düz karakter
    flushBytes();
    if (skipChars > 0) { skipChars--; i++; continue; }
    put(ch);
    i++;
  }
  endPara();

  const out: Block[] = [];
  for (const runs of paras) {
    const text = runs.map((r) => r.t).join("").trim();
    if (!text) continue;
    out.push({ k: "p", runs: runs.map((r) => ({ ...r, t: r.t.replace(/\s+/g, " ") })).filter((r) => r.t) });
  }
  if (!out.length) throw new DocReadError("RTF'te metin yok", "empty");
  return out;
}

// ── XML (ODT / EPUB) ─────────────────────────────────────────────

const parseXml = (s: string, type: DOMParserSupportedType = "application/xml"): Document => new DOMParser().parseFromString(s, type);
const hasParseError = (d: Document) => !!d.getElementsByTagName("parsererror").length;
const kids = (el: Element): Element[] => Array.from(el.children);
const lname = (el: Element) => el.localName;

function odtInline(el: Node): string {
  let s = "";
  el.childNodes.forEach((c) => {
    if (c.nodeType === 3) s += c.nodeValue ?? "";
    else if (c.nodeType === 1) {
      const e = c as Element;
      const n = lname(e);
      if (n === "s") s += " ".repeat(Math.min(50, Number(e.getAttribute("text:c") ?? e.getAttribute("c") ?? 1) || 1));
      else if (n === "tab") s += "    ";
      else if (n === "line-break") s += "\n";
      else if (n === "note" || n === "annotation" || n === "frame" || n === "bookmark") s += "";
      else s += odtInline(e);
    }
  });
  return s;
}

/** ODT → bloklar (content.xml): başlık, paragraf, liste, tablo satırları. */
export function odtToBlocks(bytes: Uint8Array): Block[] {
  let xml: string;
  try {
    const files = unzipSync(bytes, { filter: (f) => f.name === "content.xml" });
    const data = files["content.xml"];
    if (!data) throw new Error("no content");
    xml = strFromU8(data);
  } catch {
    throw new DocReadError("ODT açılamadı", "invalid");
  }
  const doc = parseXml(xml);
  if (hasParseError(doc)) throw new DocReadError("ODT içeriği okunamadı", "invalid");
  const body = Array.from(doc.getElementsByTagName("*")).find((e) => lname(e) === "text" && e.parentElement && lname(e.parentElement) === "body");
  if (!body) throw new DocReadError("ODT'de metin yok", "empty");

  const out: Block[] = [];
  const walk = (el: Element, depth: number) => {
    for (const c of kids(el)) {
      const n = lname(c);
      if (n === "h") {
        const t = collapse(odtInline(c));
        const lvl = Math.min(3, Math.max(1, Number(c.getAttribute("text:outline-level") ?? c.getAttribute("outline-level") ?? 1) || 1)) as 1 | 2 | 3;
        if (t) out.push({ k: "h", level: lvl, text: t });
      } else if (n === "p") {
        const t = odtInline(c).replace(/[ \t]+/g, " ").trim();
        if (t) out.push(depth > 0 ? { k: "p", runs: plain(t), bullet: "•", indent: depth } : { k: "p", runs: plain(t) });
      } else if (n === "list") {
        for (const item of kids(c)) if (lname(item) === "list-item") walk(item, depth + 1);
      } else if (n === "table") {
        for (const row of Array.from(c.getElementsByTagName("*")).filter((e) => lname(e) === "table-row")) {
          const cells = kids(row).filter((e) => lname(e) === "table-cell").map((cell) => collapse(odtInline(cell))).filter(Boolean);
          if (cells.length) out.push({ k: "p", runs: plain(cells.join("   |   ")) });
        }
      } else if (n === "section" || n === "list-item" || n === "table-of-content" || n === "index-body") {
        walk(c, depth);
      }
    }
  };
  walk(body, 0);
  if (!out.length) throw new DocReadError("ODT'de metin yok", "empty");
  return out;
}

const BLOCK_TAGS = new Set(["p", "li", "blockquote", "pre", "figcaption", "dt", "dd", "caption", "address"]);
const SKIP_TAGS = new Set(["script", "style", "nav", "svg", "img", "head", "math", "audio", "video"]);

function htmlText(el: Node, pre: boolean): string {
  let s = "";
  el.childNodes.forEach((c) => {
    if (c.nodeType === 3) s += c.nodeValue ?? "";
    else if (c.nodeType === 1) {
      const e = c as Element;
      const n = lname(e).toLowerCase();
      if (SKIP_TAGS.has(n)) return;
      if (n === "br") s += pre ? "\n" : " ";
      else s += htmlText(e, pre);
    }
  });
  return s;
}

/** XHTML/HTML gövdesinden bloklar üretir (EPUB bölümleri). */
export function htmlToBlocks(root: Element): Block[] {
  const out: Block[] = [];
  const walk = (el: Element, quote: boolean) => {
    for (const c of kids(el)) {
      const n = lname(c).toLowerCase();
      if (SKIP_TAGS.has(n)) continue;
      if (/^h[1-6]$/.test(n)) {
        const t = collapse(htmlText(c, false));
        if (t) out.push({ k: "h", level: Math.min(3, Number(n[1])) as 1 | 2 | 3, text: t });
      } else if (n === "pre") {
        const t = htmlText(c, true).replace(/\s+$/, "");
        if (t) out.push({ k: "code", text: t });
      } else if (n === "hr") {
        out.push({ k: "hr" });
      } else if (n === "blockquote" && !kids(c).some((k) => BLOCK_TAGS.has(lname(k).toLowerCase()))) {
        const t = collapse(htmlText(c, false));
        if (t) out.push({ k: "quote", runs: plain(t) });
      } else if (n === "li") {
        const nested = kids(c).some((k) => ["ul", "ol", "p", "div"].includes(lname(k).toLowerCase()));
        if (nested) walk(c, quote);
        else {
          const t = collapse(htmlText(c, false));
          if (t) out.push({ k: "p", runs: plain(t), bullet: "•", indent: 1 });
        }
      } else if (BLOCK_TAGS.has(n)) {
        const t = collapse(htmlText(c, false));
        if (t) out.push(quote ? { k: "quote", runs: plain(t) } : { k: "p", runs: plain(t) });
      } else if (n === "td" || n === "th") {
        const t = collapse(htmlText(c, false));
        if (t) out.push({ k: "p", runs: plain(t) });
      } else {
        // div, section, ul, ol, table, tr, body… → içeriği gez; yalnızca metin içeren kap bir paragraf olur.
        const hasBlockChild = kids(c).some((k) => {
          const kn = lname(k).toLowerCase();
          return BLOCK_TAGS.has(kn) || /^h[1-6]$/.test(kn) || ["div", "section", "ul", "ol", "table", "tr", "article", "pre", "hr", "tbody", "thead"].includes(kn);
        });
        if (hasBlockChild) walk(c, quote || n === "blockquote");
        else {
          const t = collapse(htmlText(c, false));
          if (t) out.push({ k: "p", runs: plain(t) });
        }
      }
    }
  };
  walk(root, false);
  return out;
}

const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
function resolvePath(base: string, href: string): string {
  const parts = (base + decodeURIComponent(href.split("#")[0])).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}

/** EPUB → { başlık, bloklar }: okuma sırasındaki bölümler, her bölüm yeni sayfada başlar. */
export function epubToBlocks(bytes: Uint8Array): { title: string; blocks: Block[] } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => /\.(xml|opf|xhtml|html|htm|ncx)$/i.test(f.name) });
  } catch {
    throw new DocReadError("EPUB açılamadı", "invalid");
  }
  const container = files["META-INF/container.xml"];
  if (!container) throw new DocReadError("EPUB değil", "invalid");
  const cdoc = parseXml(strFromU8(container));
  const rootfile = Array.from(cdoc.getElementsByTagName("*")).find((e) => lname(e) === "rootfile")?.getAttribute("full-path");
  const opfBytes = rootfile ? files[rootfile] : undefined;
  if (!rootfile || !opfBytes) throw new DocReadError("EPUB paket dosyası yok", "invalid");
  const opf = parseXml(strFromU8(opfBytes));
  const all = Array.from(opf.getElementsByTagName("*"));
  const manifest = new Map<string, string>();
  for (const e of all) if (lname(e) === "item") manifest.set(e.getAttribute("id") ?? "", e.getAttribute("href") ?? "");
  const spine = all.filter((e) => lname(e) === "itemref" && e.getAttribute("linear") !== "no").map((e) => e.getAttribute("idref") ?? "");
  const title = collapse(all.find((e) => lname(e) === "title")?.textContent ?? "");
  const base = dirOf(rootfile);
  const blocks: Block[] = [];
  let first = true;
  for (const id of spine.slice(0, 2000)) {
    const href = manifest.get(id);
    const data = href ? files[resolvePath(base, href)] : undefined;
    if (!data) continue;
    const src = strFromU8(data);
    let doc = parseXml(src, "application/xhtml+xml");
    if (hasParseError(doc)) doc = parseXml(src, "text/html");
    const bodyEl = doc.getElementsByTagName("body")[0] ?? doc.documentElement;
    const part = htmlToBlocks(bodyEl);
    if (!part.length) continue;
    if (!first) blocks.push({ k: "break" });
    first = false;
    blocks.push(...part);
  }
  if (!blocks.length) throw new DocReadError("EPUB'ta metin yok", "empty");
  return { title, blocks };
}
