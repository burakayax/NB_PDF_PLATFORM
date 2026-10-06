import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { logAdminAudit } from "./admin-audit.service.js";

/**
 * YÖNETİM — İTİRAZ / ANLAŞMAZLIK DOSYASI.
 *
 *  • GET  /api/admin/users/:id/dispute-file   → bir kullanıcının ödeme, abonelik, kullanım, indirme ve
 *                                              çıktı-parmak-izi kayıtlarını tek belgede toplar
 *                                              (müşteri itirazı, tüketici hakem heyeti, mahkeme/kurum talebi).
 *                                              ?format=json ile makine okunur biçim.
 *  • POST /api/admin/output-records/verify    → müşterinin elindeki dosyayı yükle; SHA-256'sı bizim sunucudan
 *                                              çıkan bir kayıtla eşleşiyor mu? (dosya SAKLANMAZ)
 *
 * GİZLİLİK: Belge içeriği hiçbir yerde tutulmaz; yalnızca parmak izi. TC kimlik no, telefon, kart
 * bilgisi gibi alanlar dosyaya KONMAZ. Her erişim denetim kaydına yazılır.
 */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function actorOf(req: Request): { userId: string; email: string } {
  const u = req.authUser;
  if (!u) throw new HttpError(401, "Authentication is required.");
  return { userId: u.id, email: u.email };
}

export async function adminUserDisputeFileController(req: Request, res: Response): Promise<void> {
  const id = typeof req.params["id"] === "string" ? req.params["id"] : "";
  if (!id) throw new HttpError(400, "Missing user id.");
  // Kullanıcı numarası YA DA e-posta kabul edilir (itiraz e-postayla gelir).
  const user = await prisma.user.findUnique({
    where: id.includes("@") ? { email: id.trim().toLowerCase() } : { id },
    include: { organization: true },
  });
  if (!user) throw new HttpError(404, "User not found.");
  const uid = user.id;

  const [payments, invoices, operations, downloads, outputs, aiUsage, contractReviews, aiRequests] = await Promise.all([
    prisma.paymentCheckout.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.invoice.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.operationLog.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.downloadLog.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.outputRecord.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.aiUsage.findMany({ where: { userId: uid }, orderBy: { yearMonth: "desc" }, take: 24 }),
    prisma.contractReviewLog.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.aiRequestLog.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 300 }),
  ]);

  const org = user.organization;
  const dossier = {
    generatedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      createdAt: iso(user.createdAt),
      lastLoginAt: iso(user.lastLoginAt),
      plan: user.plan,
      country: user.country,
      kvkkConsentedAt: iso(user.kvkkConsentedAt),
      distanceSalesConsentedAt: iso(user.distanceSalesConsentedAt),
      withdrawalWaivedAt: iso(user.withdrawalWaivedAt),
      totalRefunds: user.totalRefunds,
      firstRefundedAt: iso(user.firstRefundedAt),
      lastRefundedAt: iso(user.lastRefundedAt),
      totalOperationsCount: user.totalOperationsCount,
    },
    subscription: org
      ? {
          plan: org.plan,
          status: org.subscriptionStatus,
          billingCycle: org.billingCycle,
          expiresAt: iso(org.subscriptionExpiry),
          tempOverrideUntil: iso(org.overrideExpiresAt),
        }
      : null,
    payments: payments.map((p) => ({
      id: p.id,
      createdAt: iso(p.createdAt),
      completedAt: iso(p.completedAt),
      status: p.status,
      plan: p.plan,
      billingCycle: p.billingCycle,
      priceTry: p.priceTry,
      couponId: p.couponId,
      bonusAiCredits: p.bonusAiCredits,
      refundedAt: iso(p.refundedAt),
      refundReason: p.refundReason,
      iyzicoPaymentId: p.iyzicoPaymentId,
    })),
    invoices: invoices.map((i) => ({
      invoiceNo: i.invoiceNo,
      status: i.status,
      grossAmount: i.grossAmount,
      currency: i.currency,
      createdAt: iso(i.createdAt),
      creditNoteIssuedAt: iso(i.creditNoteIssuedAt),
    })),
    operations: operations.map((o) => ({
      at: iso(o.createdAt),
      tool: o.toolType,
      status: o.status,
      files: o.fileCount,
      sizeMB: o.totalFileSizeMB,
      batch: o.isBatch,
      ms: o.processingTimeMs,
    })),
    downloads: downloads.map((d) => ({
      at: iso(d.createdAt),
      tool: d.toolId,
      resultId: d.resultId,
      status: d.status,
      ackedAt: iso(d.ackedAt),
      ip: d.clientIp,
      userAgent: d.userAgent,
    })),
    outputRecords: outputs.map((o) => ({
      at: iso(o.createdAt),
      producedAt: iso(o.producedAt),
      tool: o.toolId,
      resultId: o.resultId,
      sha256: o.fileSha256,
      sizeBytes: o.fileSizeBytes,
      planAtTime: o.planAtTime,
    })),
    aiUsageByMonth: aiUsage.map((a) => ({ month: a.yearMonth, count: a.count, byTool: a.operationCounts })),
    aiRequests: aiRequests.map((a) => ({
      at: iso(a.createdAt),
      op: a.op,
      units: a.units,
      status: a.status,
      refunded: a.refunded,
      planAtTime: a.planAtTime,
      inputSha256: a.inputSha256,
      outputSha256: a.outputSha256,
      ip: a.clientIp,
    })),
    contractReviews: contractReviews.map((c) => ({
      id: c.id,
      at: iso(c.createdAt),
      mode: c.mode,
      units: c.units,
      status: c.status,
      failReason: c.failReason,
      refundedAt: iso(c.refundedAt),
      consentVersion: c.consentVersion,
      consentAt: iso(c.consentAt),
      docSha256: c.docSha256,
      reportSha256: c.reportSha256,
    })),
  };

  await logAdminAudit(actorOf(req), "dispute_file_export", uid, `İtiraz dosyası oluşturuldu: ${user.email}`);

  if (req.query["format"] === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="dispute-${uid}.json"`);
    res.json(dossier);
    return;
  }

  const L: string[] = [];
  const row = (...cols: (string | number | boolean | null | undefined)[]) =>
    L.push("  " + cols.map((c) => (c === null || c === undefined || c === "" ? "-" : String(c))).join(" | "));
  L.push("PDF PLATFORM — İTİRAZ / ANLAŞMAZLIK DOSYASI");
  L.push(`Oluşturulma (UTC): ${dossier.generatedAt}`);
  L.push("");
  L.push("[1] KULLANICI");
  const u = dossier.user;
  L.push(`  Kullanıcı No: ${u.id}`);
  L.push(`  E-posta: ${u.email}`);
  L.push(`  Kayıt tarihi: ${u.createdAt}   Son giriş: ${u.lastLoginAt ?? "-"}`);
  L.push(`  Güncel plan: ${u.plan}   Ülke: ${u.country ?? "-"}`);
  L.push(`  KVKK onayı: ${u.kvkkConsentedAt ?? "-"}`);
  L.push(`  Mesafeli satış onayı: ${u.distanceSalesConsentedAt ?? "-"}`);
  L.push(`  Cayma hakkından feragat onayı: ${u.withdrawalWaivedAt ?? "-"}`);
  L.push(`  Toplam iade: ${u.totalRefunds}   İlk iade: ${u.firstRefundedAt ?? "-"}   Son iade: ${u.lastRefundedAt ?? "-"}`);
  L.push(`  Toplam işlem sayısı: ${u.totalOperationsCount}`);
  L.push("");
  L.push("[2] ABONELİK");
  const s = dossier.subscription;
  L.push(
    s
      ? `  Plan: ${s.plan}   Durum: ${s.status}   Dönem: ${s.billingCycle ?? "-"}   Bitiş: ${s.expiresAt ?? "-"}   Geçici yetki bitişi: ${s.tempOverrideUntil ?? "-"}`
      : "  (abonelik kaydı yok)",
  );
  L.push("");
  L.push(`[3] ÖDEMELER (${dossier.payments.length})  — tarih | durum | plan | dönem | tutar(TL) | tamamlanma | iade | iade nedeni | iyzico no`);
  dossier.payments.forEach((p) =>
    row(p.createdAt, p.status, p.plan, p.billingCycle, p.priceTry, p.completedAt, p.refundedAt, p.refundReason, p.iyzicoPaymentId),
  );
  L.push("");
  L.push(`[4] FATURALAR (${dossier.invoices.length})  — fatura no | durum | brüt | tarih | iade faturası`);
  dossier.invoices.forEach((i) => row(i.invoiceNo, i.status, `${i.grossAmount} ${i.currency}`, i.createdAt, i.creditNoteIssuedAt));
  L.push("");
  L.push(`[5] İŞLEM KAYITLARI (son ${dossier.operations.length})  — tarih | araç | durum | dosya | MB | toplu | ms`);
  dossier.operations.forEach((o) => row(o.at, o.tool, o.status, o.files, o.sizeMB, o.batch, o.ms));
  L.push("");
  L.push(`[6] İNDİRME KAYITLARI (son ${dossier.downloads.length})  — tarih | araç | sonuç no | durum | onay | IP`);
  dossier.downloads.forEach((d) => row(d.at, d.tool, d.resultId, d.status, d.ackedAt, d.ip));
  L.push("");
  L.push(`[7] ÇIKTI PARMAK İZLERİ (${dossier.outputRecords.length})  — tarih | araç | sonuç no | SHA-256 | bayt | o günkü plan`);
  dossier.outputRecords.forEach((o) => row(o.at, o.tool, o.resultId, o.sha256, o.sizeBytes, o.planAtTime));
  L.push("");
  L.push("[8] YAPAY ZEKÂ KULLANIMI (aylık)");
  dossier.aiUsageByMonth.forEach((a) => row(a.month, a.count, a.byTool ? JSON.stringify(a.byTool) : "-"));
  L.push("");
  L.push(`[8b] YAPAY ZEKÂ İSTEKLERİ (son ${dossier.aiRequests.length})  — tarih | araç | hak | durum | iade | o günkü plan | girdi özeti | çıktı özeti`);
  dossier.aiRequests.forEach((a) => row(a.at, a.op, a.units, a.status, a.refunded ? "İADE" : "-", a.planAtTime, a.inputSha256?.slice(0, 16), a.outputSha256?.slice(0, 16)));
  L.push("");
  L.push(`[9] SÖZLEŞME DENETÇİSİ (${dossier.contractReviews.length})  — no | tarih | mod | hak | durum | iade | onay sürümü`);
  dossier.contractReviews.forEach((c) => row(c.id, c.at, c.mode, c.units, c.status, c.refundedAt, c.consentVersion));
  L.push("");
  L.push("NOT: Belge içerikleri sunucuda saklanmaz; yalnızca parmak izleri (SHA-256) tutulur. Cihazda");
  L.push("işlenen araçlarda (tarayıcıda çalışan) sunucudan dosya çıkmaz, bu yüzden parmak izi kaydı yoktur.");
  L.push('Dosya doğrulama: yönetim panelinde "Dosya doğrula" ile müşterinin dosyası yüklenir ve [7] ile karşılaştırılır.');

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="dispute-${uid}.txt"`);
  res.send(L.join("\n"));
}

/** POST /api/admin/output-records/verify  (gövde: ham dosya) */
export async function adminVerifyOutputFileController(req: Request, res: Response): Promise<void> {
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(400, "Dosya gönderilmedi.");
  const sha = createHash("sha256").update(body).digest("hex");
  const matches = await prisma.outputRecord.findMany({
    where: { fileSha256: sha },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { email: true } } },
  });
  await logAdminAudit(actorOf(req), "output_file_verify", null, `Dosya doğrulama: ${matches.length ? "EŞLEŞTİ" : "eşleşme yok"}`, { sha256: sha });
  res.json({
    sha256: sha,
    sizeBytes: body.length,
    matched: matches.length > 0,
    records: matches.map((m) => ({
      userId: m.userId,
      userEmail: m.user.email,
      tool: m.toolId,
      resultId: m.resultId,
      producedAt: iso(m.producedAt) ?? iso(m.createdAt),
      planAtTime: m.planAtTime,
    })),
    explanation: matches.length
      ? "Bu dosyanın parmak izi sunucumuzdan çıkan bir çıktıyla BİREBİR eşleşiyor: dosya değiştirilmemiş."
      : "Bu dosyanın parmak izi hiçbir sunucu çıktısıyla eşleşmiyor: dosya sonradan değiştirilmiş, bizden çıkmamış veya cihazda (tarayıcıda) işlenmiş olabilir.",
  });
}
