import { prisma } from "./prisma.js";

/**
 * Hesap silinirken, kullanıcıya veritabanı ilişkisiyle (Cascade) BAĞLI OLMAYAN kişisel verileri siler.
 *
 * NEDEN: `prisma.user.delete` yalnız ilişkili satırları siler. Belge tarayıcının kaydettiği taramalar
 * (kimlik, fatura vb. içerebilir) ve ekip üyeliği satırı (davet e-postası) kullanıcıya ilişkiyle bağlı
 * değildi; hesap silinse de kalıyorlardı. KVKK md. 7 / GDPR md. 17: işleme amacı bitince silinmeli.
 *
 * KASITLI OLARAK SİLİNMEYENLER (yasal saklama):
 *  - Ödeme/fatura kayıtları → FinancialRecordArchive (10 yıl, sonra otomatik silinir).
 *  - Pazarlama izni kanıtı (MarketingConsentLog) → 3 yıl sonra otomatik silinir (dataRetentionJobs).
 *
 * Silme çağrılarından ÖNCE çalıştırılmalıdır; hata atarsa hesap silinmemelidir.
 */
export async function purgeUserDataBeforeDelete(userId: string): Promise<{ scans: number; teamMemberships: number }> {
  const [scans, memberships] = await Promise.all([
    prisma.scannedDocument.deleteMany({ where: { userId } }),
    prisma.teamMember.deleteMany({ where: { userId } }),
  ]);
  return { scans: scans.count, teamMemberships: memberships.count };
}
