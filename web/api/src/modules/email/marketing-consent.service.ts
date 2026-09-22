/**
 * Ticari ileti onayının kanıt defteri.
 *
 * NEDEN: Kullanıcı kaydındaki izin alanı "şu an izin var mı?" sorusunu
 * cevaplıyor. Ticari İletişim Yönetmeliği ise onayın İSPATINI istiyor ve ispat
 * yükünü gönderene veriyor: onayın tarihi, alındığı kanal ve kullanıcının
 * onayladığı metin gösterilebilmeli. Bu defter o kanıtı tutar.
 *
 * NEDEN RET DE KAYDEDİLİYOR: Ret talebinin işlendiğini ispatlamak da gönderenin
 * yükümlülüğü. "Çıktım ama e-posta gelmeye devam etti" şikâyetinde tek
 * savunma, reddin ne zaman işlendiğini gösteren kayıttır.
 */

import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/file-log.js";

/** Onayın/reddin hangi kanaldan geldiği. */
export type ConsentSource = "signup" | "settings" | "unsubscribe_link" | "admin";

export type ConsentRecordInput = {
  userId: string;
  email: string;
  granted: boolean;
  source: ConsentSource;
  /** Onay anında kullanıcıya gösterilen metin. Ret kayıtlarında boş bırakılır. */
  consentText?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Kanıtı deftere yazar.
 *
 * NEDEN HATA YUTULUYOR: Kanıt yazılamadı diye kullanıcının kaydı ya da
 * listeden çıkışı başarısız olmamalı — çıkışın engellenmesi, kanıtın
 * tutulamamasından çok daha ağır bir ihlal. Sorun log'a düşer.
 */
export async function recordMarketingConsent(input: ConsentRecordInput): Promise<void> {
  try {
    await prisma.marketingConsentLog.create({
      data: {
        userId: input.userId,
        email: input.email,
        granted: input.granted,
        source: input.source,
        consentText: input.consentText ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.error("marketing-consent", "onay kanıtı yazılamadı", { detail: String(err) });
  }
}

/**
 * Kayıt formunda gösterilen onay metni.
 *
 * NEDEN BURADA SABİT DURUYOR: Kanıtın değeri, kullanıcının GÖRDÜĞÜ metni
 * saklamaktan gelir. Metin ön yüzde değişip burada eskisi kalırsa kanıt
 * yanlış olur; bu yüzden metin değiştiğinde buradaki sürüm de artırılmalı ve
 * eski kayıtlar eski metinle kalmalıdır.
 */
export const SIGNUP_CONSENT_TEXT = {
  tr: "v1 · Kampanya, ipucu ve yeniliklerden e-posta ile haberdar olmak istiyorum. (İsteğe bağlı — istediğiniz zaman tek tıkla çıkabilirsiniz.)",
  en: "v1 · I'd like to receive emails about campaigns, tips and updates. (Optional — you can unsubscribe anytime with one click.)",
} as const;
