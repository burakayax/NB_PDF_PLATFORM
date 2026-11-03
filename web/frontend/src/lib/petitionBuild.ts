/**
 * Şablon + kullanıcı değerleri → UdfDocument (aynı belgeden hem PDF hem UDF üretilir).
 * Saf mantık: tarayıcı API'si yok, test edilebilir.
 */
import { COMMON_FIELDS, type PetitionTemplate } from "../content/petitionTemplates";
import type { UdfBlock, UdfDocument } from "./udf";
import { emptyParagraph } from "./udfWrite";
import { newUdfDocument } from "./udfConvert";

export type Values = Record<string, string>;

export const todayTr = (d = new Date()) =>
  `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** Satırdaki yer tutucuları doldurur. Değeri boş bir alan varsa satır dışarı atılır (null). */
export function fillLine(line: string, v: Values): string | null {
  let missing = false;
  const out = line.replace(PLACEHOLDER, (_, k: string) => {
    const val = (v[k] ?? "").trim();
    if (!val) missing = true;
    return val;
  });
  return missing ? null : out;
}

/** Zorunlu alanlardan boş olanların anahtarları. */
export function missingRequired(t: PetitionTemplate, v: Values): string[] {
  return [...COMMON_FIELDS, ...t.fields].filter((f) => !f.optional && !(v[f.key] ?? "").trim()).map((f) => f.key);
}

const para = (text: string, o: Partial<{ alignment: "left" | "center" | "right" | "justify"; bold: boolean; indent: number }> = {}): UdfBlock => ({
  ...emptyParagraph(),
  alignment: o.alignment ?? "left",
  firstLineIndent: o.indent ?? 0,
  runs: text ? [{ text, bold: o.bold }] : [],
});

export function buildPetition(t: PetitionTemplate, v: Values): UdfDocument {
  const blocks: UdfBlock[] = [];
  const recipient = fillLine(t.recipient, v) ?? t.recipient;
  blocks.push(para(recipient.toLocaleUpperCase("tr"), { alignment: "center", bold: true }));
  blocks.push(para(""));
  const subject = fillLine(t.subject, v);
  if (subject) blocks.push(para(`KONU: ${subject}`, { bold: true }));
  blocks.push(para(""));
  for (const b of t.body) {
    // Çok satırlı kullanıcı metni satır sonlarıyla gelebilir → ayrı paragraflar.
    const filled = fillLine(b, v);
    if (filled === null) continue;
    for (const piece of filled.split(/\r?\n/)) {
      if (piece.trim()) blocks.push(para(piece.trim(), { alignment: "justify", indent: 42 }));
    }
    blocks.push(para(""));
  }
  blocks.push(para(v.tarih?.trim() ?? "", { alignment: "right" }));
  blocks.push(para((v.adSoyad ?? "").trim(), { alignment: "right", bold: true }));
  blocks.push(para("İmza", { alignment: "right" }));
  blocks.push(para(""));
  const info: string[] = [];
  if ((v.tcKimlik ?? "").trim()) info.push(`T.C. Kimlik No: ${v.tcKimlik!.trim()}`);
  if ((v.adres ?? "").trim()) info.push(`Adres: ${v.adres!.trim().replace(/\s*\r?\n\s*/g, " ")}`);
  if ((v.telefon ?? "").trim()) info.push(`Telefon: ${v.telefon!.trim()}`);
  for (const line of info) blocks.push(para(line));
  return newUdfDocument(blocks);
}
