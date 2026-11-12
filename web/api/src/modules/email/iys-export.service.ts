/**
 * İYS toplu yükleme dosyası — yüklenmemiş onayları İYS biçimine çevirir.
 *
 * NEDEN: İYS, 250.000'in altındaki işletmelerin sistemini doğrudan bağlamasına
 * izin vermiyor; izinler panelden CSV ile yükleniyor (tek seferde en fazla 50).
 * Yönetici bu dosyayı indirir, İYS'ye yükler, sonra "yüklendi" olarak işaretler.
 *
 * "NE KADARI YÜKLENDİ" TAKİBİ: tek bir zaman damgası (SiteSetting). Bundan
 * sonraki kayıtlar bekliyor sayılır. Ayrı tablo/geçiş gerektirmez.
 *
 * HER E-POSTA İÇİN EN SON KAYIT geçerli: onay verip sonra geri alan kişi ret (0)
 * olarak gider.
 */

import { prisma } from "../../lib/prisma.js";

export const IYS_BATCH_SIZE = 50;
export const IYS_UPLOADED_UNTIL_KEY = "email.iys.uploadedUntil";

export const IYS_CSV_HEADER =
  "IZIN TURU,ALICI,ONAY(1)-RET(0),IZIN KAYNAGI,IZIN TARIHI,IZNIN ALINDIGI BAYI IYS NO";

export type IysLog = { email: string; granted: boolean; createdAt: Date };
export type IysRow = { email: string; granted: boolean; at: Date };

const pad = (n: number) => String(n).padStart(2, "0");

/** İYS tarih biçimi: GG-AA-YYYY SS:dd:ss — Türkiye saati (UTC+3). */
export function formatIysDate(d: Date): string {
  const t = new Date(d.getTime() + 3 * 3600 * 1000);
  return (
    `${pad(t.getUTCDate())}-${pad(t.getUTCMonth() + 1)}-${t.getUTCFullYear()} ` +
    `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`
  );
}

/** Kayıtlardan her e-posta için en son durumu çıkarır; en eskiden yeniye sıralar. */
export function latestPerEmail(logs: IysLog[]): IysRow[] {
  const map = new Map<string, IysRow>();
  for (const l of logs) {
    const email = l.email.trim().toLowerCase();
    if (!email) continue;
    const prev = map.get(email);
    if (!prev || l.createdAt.getTime() > prev.at.getTime()) {
      map.set(email, { email, granted: l.granted, at: l.createdAt });
    }
  }
  return [...map.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function toIysCsv(rows: IysRow[]): string {
  const lines = rows.map(
    (r) => `EPOSTA,${r.email},${r.granted ? 1 : 0},HS_WEB,${formatIysDate(r.at)},`,
  );
  return [IYS_CSV_HEADER, ...lines].join("\n") + "\n";
}

export async function readUploadedUntil(): Promise<Date | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key: IYS_UPLOADED_UNTIL_KEY } });
  if (!row) return null;
  const d = new Date(row.value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function writeUploadedUntil(until: Date): Promise<void> {
  const value = until.toISOString();
  await prisma.siteSetting.upsert({
    where: { key: IYS_UPLOADED_UNTIL_KEY },
    create: { key: IYS_UPLOADED_UNTIL_KEY, value },
    update: { value },
  });
}

export type PendingBatch = {
  /** Bu dosyada gidecek satırlar (en fazla 50). */
  batch: IysRow[];
  /** Toplam bekleyen adres sayısı (dosyalara bölünmeden). */
  pendingTotal: number;
  /** "Yüklendi" denince işaretlenecek zaman: dosyadaki son kaydın zamanı. */
  until: Date | null;
  uploadedUntil: Date | null;
};

export async function readPendingBatch(): Promise<PendingBatch> {
  const uploadedUntil = await readUploadedUntil();
  const logs = await prisma.marketingConsentLog.findMany({
    where: uploadedUntil ? { createdAt: { gt: uploadedUntil } } : {},
    select: { email: true, granted: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const all = latestPerEmail(logs);
  const batch = all.slice(0, IYS_BATCH_SIZE);
  return {
    batch,
    pendingTotal: all.length,
    until: batch.length ? batch[batch.length - 1]!.at : null,
    uploadedUntil,
  };
}
