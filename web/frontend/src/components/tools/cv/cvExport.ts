/**
 * CV ÇIKTILARI — Word (.docx) ve düz metin (.txt). Tamamı cihazda.
 *
 * Word çıktısı kasıtlı olarak SADE ve tek sütunludur: gerçek Word başlıkları (Başlık 1),
 * gerçek madde işaretli liste, tablo yok. Başvuru sistemleri ve Word'de düzenleme için en
 * güvenli biçim budur; görsel tasarım için PDF kullanılır. Fotoğraf Word'e eklenmez.
 */
import { buildModel, type CvData, type CvModel, type Fld, type SectionKey } from "./cvModel";
import { getTemplate } from "./cvTemplates";

const t = (f: Fld | null | undefined) => (f ? f.t : "");

type Line = { kind: "h" | "p" | "b" | "title"; text: string; right?: string; sub?: string };

/** Ortak içerik akışı: hem .docx hem .txt buradan üretilir (aynı sıra, aynı boş alan kuralı). */
export function cvLines(d: CvData): { model: CvModel; lines: Line[] } {
  const m = buildModel(d, "export");
  const L = m.labels;
  const lines: Line[] = [];
  lines.push({ kind: "title", text: t(m.name), sub: t(m.title) });
  const contact = [m.email, m.phone, m.city, m.website, m.linkedin, m.birth, m.license].map(t).filter(Boolean);
  if (contact.length) lines.push({ kind: "p", text: contact.join("  |  ") });

  const secTitle = (k: SectionKey): string => {
    if (k.startsWith("custom:")) return t(m.custom.find((c) => c.key === k)?.title);
    return ({ summary: L.profile, experience: L.experience, education: L.education, skills: L.skills, languages: L.languages, certs: L.certs, projects: L.projects, interests: L.interests, references: L.references } as Record<string, string>)[k] ?? "";
  };

  for (const k of m.order) {
    const body: Line[] = [];
    if (k === "summary" && m.summary) body.push({ kind: "p", text: t(m.summary) });
    if (k === "experience")
      for (const e of m.experience) {
        body.push({ kind: "p", text: t(e.role), right: t(e.dates), sub: [t(e.company), t(e.location)].filter(Boolean).join(" · ") });
        for (const b of e.bullets) body.push({ kind: "b", text: b.t });
      }
    if (k === "education")
      for (const e of m.education) {
        body.push({ kind: "p", text: t(e.school), right: t(e.dates), sub: [t(e.degree), t(e.location)].filter(Boolean).join(" · ") });
        for (const b of e.bullets) body.push({ kind: "b", text: b.t });
      }
    if (k === "skills" && m.skills.length) body.push({ kind: "p", text: m.skills.map((s) => t(s.name)).join(", ") });
    if (k === "languages") for (const l of m.languages) body.push({ kind: "p", text: [t(l.name), t(l.level)].filter(Boolean).join(" — ") });
    if (k === "certs") for (const c of m.certs) body.push({ kind: "p", text: [t(c.name), t(c.issuer)].filter(Boolean).join(" — "), right: t(c.date) });
    if (k === "projects") for (const p of m.projects) body.push({ kind: "p", text: [t(p.name), t(p.link)].filter(Boolean).join("  "), sub: t(p.desc) });
    if (k === "interests" && m.interests.length) body.push({ kind: "p", text: m.interests.map((i) => i.t).join(", ") });
    if (k === "references") for (const r of m.references) body.push({ kind: "p", text: t(r.name), sub: [t(r.role), t(r.contact)].filter(Boolean).join(" · ") });
    if (k.startsWith("custom:")) {
      const sec = m.custom.find((c) => c.key === k);
      for (const it of sec?.items ?? []) body.push({ kind: "p", text: t(it.title), right: t(it.date), sub: [t(it.subtitle), t(it.desc)].filter(Boolean).join(" — ") });
    }
    if (!body.length) continue;
    lines.push({ kind: "h", text: secTitle(k) });
    lines.push(...body);
  }
  return { model: m, lines };
}

/** Düz metin (.txt): başvuru formlarına yapıştırmak ve ATS kontrolü için. */
export function cvToText(d: CvData): string {
  const { lines } = cvLines(d);
  const out: string[] = [];
  for (const l of lines) {
    if (l.kind === "title") { out.push(l.text.toLocaleUpperCase(d.settings.lang)); if (l.sub) out.push(l.sub); out.push(""); }
    else if (l.kind === "h") { out.push("", l.text.toLocaleUpperCase(d.settings.lang), "-".repeat(Math.min(40, l.text.length + 6))); }
    else if (l.kind === "b") out.push(`- ${l.text}`);
    else { out.push([l.text, l.right].filter(Boolean).join("  —  ")); if (l.sub) out.push(l.sub); }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

const WORD_FONT: Record<string, string> = { carlito: "Calibri", arial: "Arial", caladea: "Cambria", gelasio: "Georgia", times: "Times New Roman" };

/** Word (.docx). `docx` kitaplığı yalnızca bu düğmeye basılınca yüklenir. */
export async function buildCvDocx(d: CvData, templateId: string): Promise<Blob> {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, TabStopType, LevelFormat, BorderStyle, AlignmentType } = docx;
  const tpl = getTemplate(templateId);
  const font = WORD_FONT[d.settings.font ?? tpl.theme.font] ?? "Calibri";
  const accent = (d.settings.accent ?? tpl.theme.accent).replace("#", "");
  const { lines } = cvLines(d);
  const sizeMul = d.settings.size === "s" ? 0.92 : d.settings.size === "l" ? 1.08 : 1;
  const sz = (pt: number) => Math.round(pt * sizeMul * 2); // yarım punto
  const TEXT_W = 9906; // A4 (11906) − 2×1000 kenar boşluğu, twip

  const children: InstanceType<typeof Paragraph>[] = [];
  for (const l of lines) {
    if (l.kind === "title") {
      children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: l.text, bold: true, size: sz(20), font })] }));
      if (l.sub) children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: l.sub, size: sz(12), color: accent, bold: true, font })] }));
    } else if (l.kind === "h") {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } },
        children: [new TextRun({ text: l.text.toLocaleUpperCase(d.settings.lang), bold: true, size: sz(10.5), color: accent, font })],
      }));
    } else if (l.kind === "b") {
      children.push(new Paragraph({ numbering: { reference: "cv-bullets", level: 0 }, spacing: { after: 20 }, children: [new TextRun({ text: l.text, size: sz(10.5), font })] }));
    } else {
      children.push(new Paragraph({
        spacing: { before: 60, after: l.sub ? 0 : 40 },
        tabStops: l.right ? [{ type: TabStopType.RIGHT, position: TEXT_W }] : undefined,
        children: [new TextRun({ text: l.text, bold: !!l.sub || !!l.right, size: sz(11), font }), ...(l.right ? [new TextRun({ text: `\t${l.right}`, size: sz(10), color: "5D6675", font })] : [])],
      }));
      if (l.sub) children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: l.sub, size: sz(10.5), color: "5D6675", font })] }));
    }
  }

  const doc = new Document({
    creator: "PDF Platform (pdfplatform.app)",
    title: `${d.name.trim() || "CV"} — ${d.settings.lang === "tr" ? "Özgeçmiş" : "Resume"}`,
    styles: { default: { document: { run: { font, size: sz(10.5) } } } },
    numbering: { config: [{ reference: "cv-bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }],
  });
  return Packer.toBlob(doc);
}
