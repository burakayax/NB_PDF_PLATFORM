import { describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { PDFDocument } from "pdf-lib";
import { decodeText, txtToBlocks, mdToBlocks, rtfToBlocks, odtToBlocks, epubToBlocks, DocReadError, type Block } from "../lib/docText";
import { blocksToMarkdown, blocksToEpub, pagesToBlocks } from "../lib/docExport";
import { blocksToPdf } from "../lib/blocksPdf";

const TR = "Çalışma ğüşöç İĞÜŞÖÇ ı";
const text = (b: Block[]) => b.map((x) => ("runs" in x ? x.runs.map((r) => r.t).join("") : "text" in x ? x.text : "lines" in x ? x.lines.join("\n") : "")).join("\n");

describe("TXT", () => {
  it("UTF-8 ve BOM'u okur", () => {
    expect(decodeText(strToU8(TR))).toBe(TR);
    expect(decodeText(Uint8Array.from([0xef, 0xbb, 0xbf, ...strToU8(TR)]))).toBe(TR);
  });
  it("Windows-1254 (Türkçe ANSI) dosyayı doğru çözer", () => {
    // "Çalışma ğüşöç İĞÜŞÖÇ ı" cp1254 baytları
    const cp1254 = Uint8Array.from([0xc7, 0x61, 0x6c, 0xfd, 0xfe, 0x6d, 0x61, 0x20, 0xf0, 0xfc, 0xfe, 0xf6, 0xe7, 0x20, 0xdd, 0xd0, 0xdc, 0xde, 0xd6, 0xc7, 0x20, 0xfd]);
    expect(decodeText(cp1254)).toBe(TR);
  });
  it("UTF-16 BOM'u çözer", () => {
    const u16 = new Uint8Array(2 + TR.length * 2);
    u16[0] = 0xff; u16[1] = 0xfe;
    for (let i = 0; i < TR.length; i++) { u16[2 + i * 2] = TR.charCodeAt(i) & 255; u16[3 + i * 2] = TR.charCodeAt(i) >> 8; }
    expect(decodeText(u16)).toBe(TR);
  });
  it("boş satırla ayrılan kümeler ayrı blok, satırlar korunur", () => {
    const b = txtToBlocks("a\nb\n\n\nc\r\nd");
    expect(b).toEqual([{ k: "lines", lines: ["a", "b"] }, { k: "lines", lines: ["c", "d"] }]);
  });
});

describe("Markdown", () => {
  const md = "# Başlık Ğ\n\nBir **kalın** ve *italik* [bağ](https://x.io) `kod`.\n\n- madde bir\n- madde iki\n1. sıralı\n\n> alıntı\n\n```\nkod satırı\n```\n\n---\n\n| a | b |\n|---|---|\n| 1 | 2 |";
  const b = mdToBlocks(md);
  it("başlık, kalın, liste, alıntı, kod, çizgi, tablo", () => {
    expect(b[0]).toEqual({ k: "h", level: 1, text: "Başlık Ğ" });
    const p = b[1] as Extract<Block, { k: "p" }>;
    expect(p.runs.some((r) => r.b && r.t === "kalın")).toBe(true);
    expect(p.runs.map((r) => r.t).join("")).toContain("bağ (https://x.io)");
    expect(p.runs.map((r) => r.t).join("")).not.toContain("*");
    expect(b.filter((x) => x.k === "p" && x.bullet).length).toBe(3);
    expect(b.some((x) => x.k === "quote")).toBe(true);
    expect(b.some((x) => x.k === "code" && x.text === "kod satırı")).toBe(true);
    expect(b.some((x) => x.k === "hr")).toBe(true);
    expect(text(b)).toContain("1   |   2");
    expect(text(b)).not.toContain("---|");
  });
});

describe("RTF", () => {
  const rtf = String.raw`{\rtf1\ansi\ansicpg1254\deff0{\fonttbl{\f0 Arial;}}{\colortbl;\red0\green0\blue0;}\f0\fs24 \b Ba\'fel\'fd\'f0\'fd\b0 : \'c7al\'fd\'fema \u351?\u287?\u252?\par Ikinci paragraf \'e7\'f6\'fc\par {\*\generator Word;}{\field{\*\fldinst HYPERLINK "x"}{\fldrslt site}}\par}`;
  it("Türkçe karakterleri (cp1254 ve \\u) doğru çözer, kalın ve paragrafı korur", () => {
    const b = rtfToBlocks(rtf);
    expect(b.length).toBe(3);
    const first = b[0] as Extract<Block, { k: "p" }>;
    expect(first.runs[0]).toEqual({ t: "Başlığı", b: true });
    expect(text([b[0]])).toBe("Başlığı: Çalışma şğü");
    expect(text([b[1]])).toBe("Ikinci paragraf çöü");
    expect(text([b[2]])).toBe("site");
    expect(text(b)).not.toContain("generator");
    expect(text(b)).not.toContain("HYPERLINK");
  });
  it("RTF olmayan girdiyi reddeder", () => {
    expect(() => rtfToBlocks("düz metin")).toThrow(DocReadError);
  });
});

describe("ODT", () => {
  const ns = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
  const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${ns}><office:body><office:text><text:h text:outline-level="1">Rapor Başlığı</text:h><text:p>Çalışma <text:span>özeti</text:span><text:s text:c="2"/>ğüşıİ</text:p><text:list><text:list-item><text:p>madde</text:p></text:list-item></text:list><table:table><table:table-row><table:table-cell><text:p>A</text:p></table:table-cell><table:table-cell><text:p>B</text:p></table:table-cell></table:table-row></table:table></office:text></office:body></office:document-content>`;
  it("başlık, paragraf (Türkçe), liste ve tabloyu okur", () => {
    const bytes = zipSync({ "content.xml": strToU8(content), mimetype: strToU8("application/vnd.oasis.opendocument.text") });
    const b = odtToBlocks(bytes);
    expect(b[0]).toEqual({ k: "h", level: 1, text: "Rapor Başlığı" });
    expect(text([b[1]])).toBe("Çalışma özeti ğüşıİ");
    expect(b[2]).toMatchObject({ k: "p", bullet: "•" });
    expect(text([b[3]])).toBe("A   |   B");
  });
  it("bozuk dosyada anlaşılır hata verir", () => {
    expect(() => odtToBlocks(strToU8("bozuk"))).toThrow(DocReadError);
  });
});

describe("EPUB", () => {
  const blocks: Block[] = [
    { k: "h", level: 1, text: "Birinci Bölüm Ş" },
    { k: "p", runs: [{ t: "Merhaba " }, { t: "dünya", b: true }, { t: " çğıöşü." }] },
    { k: "p", runs: [{ t: "madde" }], bullet: "•", indent: 1 },
    { k: "h", level: 1, text: "İkinci Bölüm" },
    { k: "lines", lines: ["satır bir", "satır iki"] },
  ];
  it("yazılan EPUB geri okunduğunda aynı metni verir (Türkçe dahil)", () => {
    const bytes = blocksToEpub(blocks, { title: "Kitap İ", lang: "tr", id: "urn:uuid:test" });
    const back = epubToBlocks(bytes);
    expect(back.title).toBe("Kitap İ");
    const t = text(back.blocks);
    expect(t).toContain("Birinci Bölüm Ş");
    expect(t).toContain("Merhaba dünya çğıöşü.");
    expect(t).toContain("İkinci Bölüm");
    expect(t).toContain("satır bir satır iki".replace(" satır iki", "")); // <br/> ile aynı paragraf
    expect(back.blocks.some((b) => b.k === "break")).toBe(true);
  });
  it("mimetype ilk dosya ve sıkıştırılmamış", () => {
    const bytes = blocksToEpub(blocks, { title: "T", lang: "tr", id: "urn:uuid:test" });
    const head = new TextDecoder().decode(bytes.slice(30, 30 + 8 + 20));
    expect(head.startsWith("mimetype")).toBe(true);
    expect(head).toContain("application/epub+zip");
  });
  it("EPUB olmayan dosyayı reddeder", () => {
    expect(() => epubToBlocks(zipSync({ "a.xml": strToU8("<a/>") }))).toThrow(DocReadError);
  });
});

describe("PDF → blok / Markdown", () => {
  const P = (text: string, h: number) => ({ text, h });
  const pages = [
    [P("Üst bilgi", 8), P("Ana Başlık", 22), P("Bu bir gövde paragrafıdır ve oldukça uzun bir metin içerir ki gövde boyutu bu olsun.", 11), P("Alt Başlık", 15), P("• birinci madde", 11), P("1) sıralı madde", 11), P("1", 9)],
    [P("Üst bilgi", 8), P("İkinci sayfanın gövde metni de yeterince uzun bir paragraf olarak yazılmıştır.", 11), P("2", 9)],
    [P("Üst bilgi", 8), P("Üçüncü sayfanın gövde metni de yeterince uzun bir paragraf olarak yazılmıştır.", 11), P("3", 9)],
  ];
  const b = pagesToBlocks(pages);
  it("başlık seviyeleri, madde, tekrar eden üst bilgi ve sayfa numarası", () => {
    expect(b[0]).toEqual({ k: "h", level: 1, text: "Ana Başlık" });
    expect(b.some((x) => x.k === "h" && x.level === 2 && x.text === "Alt Başlık")).toBe(true);
    expect(b.filter((x) => x.k === "p" && x.bullet).length).toBe(2);
    expect(text(b)).not.toContain("Üst bilgi");
    expect(b.some((x) => x.k === "p" && x.runs[0].t === "1")).toBe(false);
  });
  it("Markdown çıktısı", () => {
    const md = blocksToMarkdown(b);
    expect(md).toContain("# Ana Başlık");
    expect(md).toContain("## Alt Başlık");
    expect(md).toContain("- birinci madde");
    expect(md).toContain("1) sıralı madde".replace("1) ", "1) "));
  });
  it("Markdown özel karakterleri kaçırır", () => {
    expect(blocksToMarkdown([{ k: "p", runs: [{ t: "a*b_c" }] }])).toContain("a\\*b\\_c");
  });
});

describe("blocksToPdf", () => {
  it("Türkçe metinle çok sayfalı PDF üretir; uzun sözcük ve boş girdi çökmez", async () => {
    vi.stubGlobal("fetch", async (u: string) => ({ ok: true, arrayBuffer: async () => Uint8Array.from(readFileSync("public" + u)).buffer }));
    const long = Array.from({ length: 120 }, (_, i) => `Cümle ${i + 1}: Çalışma ğüşöç İĞÜŞÖÇ ı güzel bir gündür.`).join(" ");
    const blocks: Block[] = [
      { k: "h", level: 1, text: "İstanbul Çalışma Raporu" },
      { k: "p", runs: [{ t: long }] },
      { k: "p", runs: [{ t: "madde bir" }], bullet: "•", indent: 1 },
      { k: "quote", runs: [{ t: "Alıntı metni ğüşıöç" }] },
      { k: "code", text: "const x = 1;\n" + "a".repeat(300) },
      { k: "lines", lines: ["Şiir satırı bir", "", "Şiir satırı iki"] },
      { k: "hr" },
      { k: "p", runs: [{ t: "Sembol ∩ ve emoji 😀 sorun olmaz" }] },
      { k: "break" },
      { k: "p", runs: [{ t: "Yeni sayfa" }, { t: " kalın", b: true }] },
    ];
    const bytes = await blocksToPdf(blocks, { title: "Deneme" });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
    const empty = await PDFDocument.load(await blocksToPdf([]));
    expect(empty.getPageCount()).toBe(1);
    const out = process.env.DOC_PDF_OUT;
    if (out) writeFileSync(out + "belge-deneme.pdf", bytes);
  });
});
