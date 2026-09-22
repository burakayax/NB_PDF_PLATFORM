/**
 * Ticari e-posta uyumu — yönetim uçları (`/api/admin/email-compliance`).
 *
 * İKİ İŞ:
 *   1. Gönderen kimliği (unvan/MERSİS ya da ad-soyad/T.C., iletişim, adres) —
 *      okuma ve kaydetme. Bu bilgiler tanıtım e-postalarının altında görünür
 *      ve eksikse ticari gönderim tamamen durur.
 *   2. Onay kanıt defteri — kim, ne zaman, hangi kanaldan onay verdi ya da
 *      listeden çıktı. Listelenir ve belge olarak indirilebilir.
 *
 * NEDEN AYRI DOSYA: Misafire açık uçlarla aynı yerde durursa biri yanlışlıkla
 * açık listeye ekleyebilir. Yönetim koruması her yönlendiricide AYRI uygulanır;
 * "/api/admin" kökünde toplu bir koruma YOK.
 */

import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError } from "../../lib/http-error.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { logAdminAudit, type AdminActor } from "../admin/admin-audit.service.js";
import {
  missingSenderIdentityFields,
  readSenderIdentity,
  writeSenderIdentity,
} from "./sender-identity.service.js";

/** İşlemi yapan yöneticiyi kimliklendirir (denetim kaydı için). */
function adminActor(request: { authUser?: { id?: string; email?: string } }): AdminActor {
  const u = request.authUser;
  if (!u?.id || !u?.email) {
    throw new HttpError(401, "Yönetici oturumu gerekli.");
  }
  return { userId: u.id, email: u.email };
}

export const emailComplianceAdminRouter: Router = Router();

// Bu satır olmadan uçlar açıktır.
emailComplianceAdminRouter.use(requireAdmin);

/* ─── Gönderen kimliği ──────────────────────────────────────────────────── */

const identitySchema = z.object({
  legalName: z.string().max(200),
  entityType: z.enum(["company", "sole"]),
  mersisNo: z.string().max(40),
  tckn: z.string().max(20),
  phone: z.string().max(40),
  contactEmail: z.string().max(200),
  postalAddress: z.string().max(500),
});

emailComplianceAdminRouter.get(
  "/identity",
  asyncHandler(async (_request, response) => {
    const identity = await readSenderIdentity();
    response.json({
      identity,
      missing: missingSenderIdentityFields(identity),
    });
  }),
);

emailComplianceAdminRouter.put(
  "/identity",
  asyncHandler(async (request, response) => {
    const parsed = identitySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Geçersiz bilgi.");
    }

    const saved = await writeSenderIdentity(parsed.data);
    const missing = missingSenderIdentityFields(saved);

    await logAdminAudit(
      adminActor(request),
      "email.sender_identity.update",
      "sender_identity",
      `Gönderen kimliği güncellendi (${saved.entityType === "company" ? "şirket" : "şahıs"})`,
      { missingCount: missing.length },
    );

    response.json({ ok: true, identity: saved, missing });
  }),
);

/* ─── Onay kanıt defteri ────────────────────────────────────────────────── */

/** Bir sayfada en fazla kaç kayıt — tarayıcıyı boğmadan geniş pencere. */
const MAX_PAGE = 200;

type ConsentRow = {
  id: string;
  userId: string;
  email: string;
  granted: boolean;
  source: string;
  consentText: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
};

/** Arama terimi: e-posta ya da kullanıcı kimliği içinde geçen metin. */
function whereFor(q: string) {
  const term = q.trim();
  if (!term) return {};
  return {
    OR: [
      { email: { contains: term } },
      { userId: { contains: term } },
    ],
  };
}

emailComplianceAdminRouter.get(
  "/consents",
  asyncHandler(async (request, response) => {
    const q = String(request.query.q ?? "");
    const rawLimit = Number(request.query.limit);
    const rawOffset = Number(request.query.offset);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), MAX_PAGE);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
    const where = whereFor(q);

    const [rows, total, grantedCount] = await Promise.all([
      prisma.marketingConsentLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.marketingConsentLog.count({ where }),
      prisma.marketingConsentLog.count({ where: { ...where, granted: true } }),
    ]);

    response.json({
      rows,
      total,
      offset,
      limit,
      totals: { granted: grantedCount, revoked: total - grantedCount },
    });
  }),
);

/**
 * Defteri CSV olarak indirir — denetimde belge olarak sunulabilsin diye.
 *
 * NEDEN CSV: Hem Excel'de açılır hem düz metin olarak okunur; PDF üretmek için
 * ek bağımlılık gerekirdi ve resmî talepte istenen şey verinin kendisi, biçimi
 * değil. Arama filtresi uygulanmışsa yalnız eşleşen kayıtlar iner.
 */
emailComplianceAdminRouter.get(
  "/consents/export",
  asyncHandler(async (request, response) => {
    const q = String(request.query.q ?? "");
    const rows: ConsentRow[] = await prisma.marketingConsentLog.findMany({
      where: whereFor(q),
      orderBy: { createdAt: "desc" },
    });

    const header = [
      "Kayıt No",
      "Kullanıcı Kimliği",
      "E-posta",
      "İşlem",
      "Kanal",
      "Onaylanan Metin",
      "IP Adresi",
      "Tarayıcı Bilgisi",
      "Tarih ve Saat",
    ];

    const csv = [header, ...rows.map(toCsvRow)]
      .map((cols) => cols.map(csvCell).join(";"))
      .join("\r\n");

    const stamp = new Date().toISOString().slice(0, 10);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="ticari-ileti-onay-kayitlari-${stamp}.csv"`,
    );
    // BOM: Excel'in Türkçe karakterleri doğru göstermesi için şart.
    response.send("﻿" + csv);

    await logAdminAudit(
      adminActor(request),
      "email.consent_log.export",
      "consent_logs",
      `Onay kayıtları dışa aktarıldı (${rows.length} kayıt)`,
      { count: rows.length, query: q || null },
    );
  }),
);

const SOURCE_LABEL: Record<string, string> = {
  signup: "Kayıt formu",
  settings: "Hesap ayarları",
  unsubscribe_link: "E-postadaki çıkış bağlantısı",
  admin: "Yönetici işlemi",
};

function toCsvRow(r: ConsentRow): string[] {
  return [
    r.id,
    r.userId,
    r.email,
    r.granted ? "Onay verildi" : "Onay geri alındı",
    SOURCE_LABEL[r.source] ?? r.source,
    r.consentText ?? "",
    r.ip ?? "",
    r.userAgent ?? "",
    r.createdAt.toISOString(),
  ];
}

/**
 * CSV hücresi kaçışı.
 *
 * Tırnak ikilenir ve hücre tırnağa alınır. Ayrıca `=`, `+`, `-`, `@` ile
 * başlayan değerlerin önüne tek tırnak konur: Excel bunları formül sanıp
 * çalıştırabiliyor ve kullanıcıdan gelen bir metin (tarayıcı bilgisi gibi)
 * bu karakterle başlayabilir.
 */
function csvCell(value: string): string {
  const risky = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${risky.replace(/"/g, '""')}"`;
}
