import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { canonicalJson, sha256Hex, verifySignature, type ProofRecord } from "./contract-review.ledger.js";

/**
 * YÖNETİM — Sözleşme Denetçisi kayıtları ve DELİL araçları.
 *  • liste: kim, ne zaman, hangi modu, kaç hak/kredi, onay, sonuç, iade, indirme
 *  • proof: tek analiz için düz metin delil çıktısı (anlaşmazlık/dava için)
 *  • verify: kullanıcının elindeki PDF'i yükle → dosyaya gömülü imzalı kayıt bizim ürettiğimiz rapor mu,
 *            içerik değiştirilmiş mi?
 */

type DownloadRow = { resultId: string | null; status: string; ackedAt: Date | null; clientIp: string | null; userAgent: string | null; createdAt: Date };

async function downloadsFor(ids: string[]): Promise<Map<string, DownloadRow[]>> {
  const map = new Map<string, DownloadRow[]>();
  if (!ids.length) return map;
  const rows = await prisma.downloadLog.findMany({
    where: { toolId: "sozlesme-denetci", OR: ids.map((id) => ({ resultId: { startsWith: `${id}:` } })) },
    orderBy: { createdAt: "asc" },
    select: { resultId: true, status: true, ackedAt: true, clientIp: true, userAgent: true, createdAt: true },
  });
  for (const r of rows) {
    const id = (r.resultId ?? "").split(":")[0] ?? "";
    map.set(id, [...(map.get(id) ?? []), r as DownloadRow]);
  }
  return map;
}

/** GET /api/admin/contract-reviews?page&limit */
export async function adminListContractReviewsController(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number.parseInt(String(req.query["page"] ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query["limit"] ?? "50"), 10) || 50));
  const [total, rows] = await Promise.all([
    prisma.contractReviewLog.count(),
    prisma.contractReviewLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { email: true } } },
    }),
  ]);
  const dl = await downloadsFor(rows.map((r) => r.id));
  res.json({
    total,
    page,
    limit,
    items: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.user.email,
      mode: r.mode,
      units: r.units,
      chargeSource: r.chargeSource,
      status: r.status,
      failReason: r.failReason,
      refundedAt: r.refundedAt?.toISOString() ?? null,
      consentVersion: r.consentVersion,
      consentAt: r.consentAt.toISOString(),
      clientIp: r.clientIp,
      createdAt: r.createdAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      downloads: (dl.get(r.id) ?? []).map((d) => ({
        kind: (d.resultId ?? "").split(":")[1] ?? "",
        at: (d.ackedAt ?? d.createdAt).toISOString(),
      })),
    })),
  });
}

/** GET /api/admin/contract-reviews/:id/proof — düz metin delil çıktısı. */
export async function adminContractReviewProofController(req: Request, res: Response): Promise<void> {
  const id = typeof req.params["id"] === "string" ? req.params["id"] : "";
  if (!id) throw new HttpError(400, "Missing id.");
  const r = await prisma.contractReviewLog.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
  if (!r) throw new HttpError(404, "Not found.");
  const dl = (await downloadsFor([id])).get(id) ?? [];
  const chargeTr =
    r.chargeSource === "admin_exempt" ? "Yönetici hesabı — hak/kredi düşülmedi"
    : r.chargeSource === "credit" ? "Yalnızca satın alınmış kredi"
    : "Önce aylık hak, bitince kredi";
  const text =
    `PDF PLATFORM — Sözleşme Denetçisi işlem kaydı (delil çıktısı)\n` +
    `Rapor/İşlem No: ${r.id}\n` +
    `Oluşturma (UTC): ${r.createdAt.toISOString()}\n` +
    `Kullanıcı: ${r.user.email} (${r.userId})\n` +
    `\n` +
    `── KULLANICI ONAYI ──\n` +
    `Onay zamanı (UTC): ${r.consentAt.toISOString()}\n` +
    `Onay metni sürümü: ${r.consentVersion}\n` +
    `IP: ${r.clientIp ?? "(bilinmiyor)"}\n` +
    `Tarayıcı: ${r.userAgent ?? "(bilinmiyor)"}\n` +
    `Onaylanan işlem: ${r.mode === "quick" ? "Hızlı tarama" : "Detaylı denetim"}, ${r.units} ${r.mode === "quick" ? "hak" : "kredi"} (${chargeTr})\n` +
    `Belge: ${r.chars} karakter, SHA-256 ${r.docSha256}\n` +
    `\n` +
    `── SONUÇ ──\n` +
    `Durum: ${r.status}\n` +
    `Bitiş (UTC): ${r.finishedAt?.toISOString() ?? "(devam ediyor / bitmedi)"}\n` +
    `İade: ${r.refundedAt ? `${r.refundedAt.toISOString()} — ${r.failReason ?? ""}` : "yok"}\n` +
    `Rapor özeti (SHA-256): ${r.reportSha256 ?? "(rapor üretilmedi)"}\n` +
    `Rapor imzası (HMAC): ${r.reportSignature ?? "(yok)"}\n` +
    `\n` +
    `── İNDİRMELER (kullanıcının tarayıcısı bildirdi) ──\n` +
    (dl.length
      ? dl.map((d) => `${(d.ackedAt ?? d.createdAt).toISOString()}  ${(d.resultId ?? "").split(":").slice(1).join(" dosya SHA-256=")}  IP ${d.clientIp ?? "?"}`).join("\n")
      : "Kayıtlı indirme yok.") +
    `\n\nNot: Belge ve rapor içeriği saklanmaz; yalnızca SHA-256 özetleri tutulur. Bu çıktı anlaşmazlık çözümü içindir. ` +
    `Kullanıcının elindeki PDF'in bu işleme ait olup olmadığı, yönetim panelindeki "PDF doğrula" aracıyla sınanır.\n`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="sozlesme-denetcisi-kayit-${r.id}.txt"`);
  res.send(text);
}

/** İmzalı kaydı içeren belge-bilgisi alanı: /NBContractReview (base64) */
const RECORD_RE = /\/NBContractReview\s*\(([A-Za-z0-9+/=]+)\)/;

/**
 * POST /api/admin/contract-reviews/verify — gövde: ham PDF (Content-Type: application/pdf).
 * Dosyaya gömülü imzalı kaydı okur ve şunları sınar: (1) gömülü rapor içeriği imzalanan özetle uyuşuyor mu,
 * (2) imza bizim anahtarımızla geçerli mi, (3) deftere kaydedilen özet/imza ile aynı mı.
 */
export async function adminVerifyContractReviewController(req: Request, res: Response): Promise<void> {
  const body = req.body as unknown;
  if (!Buffer.isBuffer(body) || body.length < 100) throw new HttpError(400, "PDF dosyası gerekli (Content-Type: application/pdf).");
  const m = RECORD_RE.exec(body.toString("latin1"));
  if (!m?.[1]) {
    res.json({
      verified: false,
      found: false,
      reason:
        "Dosyada Sözleşme Denetçisi doğrulama kaydı bulunamadı. Dosya bizim çıktımız olmayabilir, kayıt silinmiş olabilir ya da dosya başka bir araçla yeniden kaydedilmiş olabilir. Bu durumda dosyanın içeriği bizim ürettiğimiz rapor olarak DOĞRULANAMAZ.",
    });
    return;
  }
  let record: { v?: number; proof?: ProofRecord; report?: Record<string, unknown> };
  try {
    record = JSON.parse(Buffer.from(m[1], "base64").toString("utf8"));
  } catch {
    res.json({ verified: false, found: true, reason: "Gömülü kayıt okunamadı (bozulmuş)." });
    return;
  }
  const proof = record.proof;
  const report = record.report;
  if (!proof || !report || typeof proof.reportId !== "string") {
    res.json({ verified: false, found: true, reason: "Gömülü kayıt eksik." });
    return;
  }
  const hashOk = sha256Hex(canonicalJson(report)) === proof.reportSha256;
  const sigOk = verifySignature(proof);
  const log = await prisma.contractReviewLog.findUnique({ where: { id: proof.reportId }, include: { user: { select: { email: true } } } });
  const ledgerOk = !!log && log.reportSha256 === proof.reportSha256 && log.reportSignature === proof.signature;
  const dl = log ? (await downloadsFor([log.id])).get(log.id) ?? [] : [];

  const findings = Array.isArray((report as { findings?: unknown }).findings) ? ((report as { findings: Array<Record<string, unknown>> }).findings) : [];
  res.json({
    verified: hashOk && sigOk && ledgerOk,
    found: true,
    checks: [
      { name: "Gömülü rapor içeriği, imzalanan özetle birebir aynı (değiştirilmemiş)", ok: hashOk },
      { name: "İmza PDF PLATFORM anahtarıyla geçerli", ok: sigOk },
      { name: "Kayıt defterindeki özet ve imza ile eşleşiyor", ok: ledgerOk },
    ],
    log: log
      ? {
          id: log.id,
          userEmail: log.user.email,
          mode: log.mode,
          units: log.units,
          createdAt: log.createdAt.toISOString(),
          consentAt: log.consentAt.toISOString(),
          status: log.status,
          refundedAt: log.refundedAt?.toISOString() ?? null,
          downloads: dl.map((d) => ({ kind: (d.resultId ?? "").split(":")[1] ?? "", at: (d.ackedAt ?? d.createdAt).toISOString() })),
        }
      : null,
    issuedAt: proof.issuedAt,
    original: {
      headline: (report as { headline?: unknown }).headline ?? null,
      riskLevel: (report as { riskLevel?: unknown }).riskLevel ?? null,
      summary: (report as { summary?: unknown }).summary ?? null,
      findings: findings.map((f) => ({ severity: f["severity"], title: f["title"], clause: f["clause"], page: f["page"] })),
    },
    note:
      "Doğrulama, dosyaya gömülü ORİJİNAL raporun bizim ürettiğimiz rapor olduğunu kanıtlar. Dosyanın görünen sayfaları başka bir araçla değiştirilmiş olabilir: " +
      "görünen içeriği 'original' alanındaki orijinal rapor özetiyle karşılaştırın.",
  });
}
