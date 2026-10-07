import { prisma } from "./prisma.js";

/**
 * MALİ KAYIT ARŞİVİ.
 *
 * NEDEN: Kullanıcı hesabını silince veritabanı ödeme ve fatura kayıtlarını da siliyordu
 * (şemadaki "Cascade"). Ticari defter ve belgelerin saklanması yasal yükümlülüktür
 * (VUK md. 253: 5 yıl, TTK md. 82: 10 yıl) ve ödeme itirazlarında (chargeback) tek kanıttır.
 *
 * Hesap silinmeden ÖNCE o kullanıcının ödeme ve fatura satırları, kullanıcıya bağlı OLMAYAN bu arşiv
 * tablosuna kopyalanır (MarketingConsentLog ile aynı yaklaşım: ilişki yok, kanıt kalır).
 * Kart bilgisi hiçbir yerde tutulmadığı için arşivde de yoktur. Kopya başarısız olursa hesap SİLİNMEZ.
 */

export const FINANCIAL_ARCHIVE_RETENTION_YEARS = 10;

export type FinancialArchiveReason = "account_deleted" | "admin_deleted";

/** Hesap silinmeden önce çağrılır; ödeme/fatura yoksa hiçbir şey yazmaz. Hata atarsa silme DURMALIDIR. */
export async function archiveFinancialRecordsBeforeDelete(userId: string, reason: FinancialArchiveReason): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, lastName: true } });
  if (!user) return false;

  const [checkouts, invoices] = await Promise.all([
    prisma.paymentCheckout.findMany({ where: { userId } }),
    prisma.invoice.findMany({ where: { userId } }),
  ]);
  if (checkouts.length === 0 && invoices.length === 0) return false;

  // iyzico belirteç özeti gibi içsel alanlar arşive taşınmaz.
  const cleanCheckouts = checkouts.map(({ iyzicoTokenHash: _omit, ...rest }) => rest);

  const retainUntil = new Date();
  retainUntil.setFullYear(retainUntil.getFullYear() + FINANCIAL_ARCHIVE_RETENTION_YEARS);

  await prisma.financialRecordArchive.create({
    data: {
      originalUserId: userId,
      emailSnapshot: user.email,
      nameSnapshot: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      reason,
      retainUntil,
      payload: JSON.parse(JSON.stringify({ paymentCheckouts: cleanCheckouts, invoices })),
    },
  });
  return true;
}
