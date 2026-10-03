import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";

/**
 * KANIT: kullanıcı "bu rapor yanlıştı" diyerek elindeki PDF'i getirirse yönetici o dosyayı yükler.
 *  • Dosyaya gömülü imzalı kayıt değişmediyse → DOĞRULANDI (bizim ürettiğimiz rapor).
 *  • Gömülü rapor içeriği değiştirildiyse ya da imza uymuyorsa → DOĞRULANAMADI.
 *  • Kayıt hiç yoksa (silinmiş / başka araçla yeniden kaydedilmiş) → "bizim çıktımız olarak doğrulanamaz".
 */

const m = vi.hoisted(() => ({ logFindUnique: vi.fn(), dlFindMany: vi.fn() }));

vi.mock("../config/env.js", () => ({ env: { JWT_ACCESS_SECRET: "s".repeat(40) } }));
vi.mock("../lib/prisma.js", () => ({
  prisma: { contractReviewLog: { findUnique: m.logFindUnique }, downloadLog: { findMany: m.dlFindMany } },
}));

const ledger = await import("../modules/ai/contract-review.ledger.js");
const admin = await import("../modules/ai/contract-review.admin.js");

const REPORT = {
  headline: "2 kritik risk",
  riskLevel: "kritik",
  summary: "Ceza tavansız.",
  findings: [{ severity: "kritik", title: "Tavansız ceza", clause: "Madde 5", page: 2 }],
};

async function pdfWithRecord(report: unknown, proof: unknown): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 300]).drawText("Test report");
  doc.setSubject("test");
  const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
  const b64 = Buffer.from(JSON.stringify({ v: 1, proof, report }), "utf8").toString("base64");
  info.set(PDFName.of("NBContractReview"), PDFString.of(b64));
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

function mkRes() {
  const r = { payload: undefined as unknown, json(p: unknown) { r.payload = p; return r; } };
  return r;
}
const verify = async (buf: Buffer) => {
  const res = mkRes();
  await admin.adminVerifyContractReviewController({ body: buf } as never, res as never);
  return res.payload as { verified: boolean; found: boolean; checks?: Array<{ ok: boolean }>; reason?: string; log?: { userEmail: string }; original?: { findings: unknown[] } };
};

beforeEach(() => {
  vi.clearAllMocks();
  m.dlFindMany.mockResolvedValue([]);
});

describe("PDF doğrulama (anlaşmazlık delili)", () => {
  it("bizim ürettiğimiz, değiştirilmemiş rapor DOĞRULANIR ve orijinal içerik gösterilir", async () => {
    const proof = ledger.signReport("job-1", REPORT, new Date("2026-10-02T10:00:00Z"));
    m.logFindUnique.mockResolvedValue({
      id: "job-1", reportSha256: proof.reportSha256, reportSignature: proof.signature, mode: "full", units: 90, status: "DONE",
      createdAt: new Date(), consentAt: new Date(), refundedAt: null, user: { email: "k@example.com" },
    });
    const r = await verify(await pdfWithRecord(REPORT, proof));
    expect(r.verified).toBe(true);
    expect(r.checks!.every((c) => c.ok)).toBe(true);
    expect(r.log!.userEmail).toBe("k@example.com");
    expect(r.original!.findings).toHaveLength(1);
  });

  it("gömülü rapor içeriği değiştirilirse DOĞRULANAMAZ", async () => {
    const proof = ledger.signReport("job-1", REPORT, new Date("2026-10-02T10:00:00Z"));
    m.logFindUnique.mockResolvedValue({
      id: "job-1", reportSha256: proof.reportSha256, reportSignature: proof.signature, mode: "full", units: 90, status: "DONE",
      createdAt: new Date(), consentAt: new Date(), refundedAt: null, user: { email: "k@example.com" },
    });
    const tampered = { ...REPORT, findings: [{ ...REPORT.findings[0], severity: "dusuk", title: "Önemsiz" }] };
    const r = await verify(await pdfWithRecord(tampered, proof));
    expect(r.verified).toBe(false);
    expect(r.checks![0]!.ok).toBe(false); // içerik özeti tutmuyor
  });

  it("imza sahteyse (başkasının ürettiği kayıt) DOĞRULANAMAZ", async () => {
    const proof = ledger.signReport("job-1", REPORT, new Date("2026-10-02T10:00:00Z"));
    m.logFindUnique.mockResolvedValue(null);
    const forged = { ...proof, signature: "0".repeat(64) };
    const r = await verify(await pdfWithRecord(REPORT, forged));
    expect(r.verified).toBe(false);
    expect(r.checks![1]!.ok).toBe(false);
  });

  it("defterde olmayan (hiç üretmediğimiz) kayıt DOĞRULANAMAZ", async () => {
    const proof = ledger.signReport("job-x", REPORT, new Date());
    m.logFindUnique.mockResolvedValue(null);
    const r = await verify(await pdfWithRecord(REPORT, proof));
    expect(r.verified).toBe(false);
    expect(r.checks![2]!.ok).toBe(false);
  });

  it("gömülü kayıt yoksa 'bizim çıktımız olarak doğrulanamaz' der", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const r = await verify(Buffer.from(await doc.save({ useObjectStreams: false })));
    expect(r.found).toBe(false);
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/doğrulanamaz/i);
  });
});
