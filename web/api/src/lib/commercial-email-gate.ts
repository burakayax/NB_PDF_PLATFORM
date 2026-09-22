/**
 * TİCARİ ELEKTRONİK İLETİ KAPISI — pazarlama e-postası göndermenin TEK yolu.
 *
 * NEDEN TEK KAPI VAR: Bu dosya yazılmadan önce izin kontrolü her gönderim
 * yerinde ayrı ayrı elle yazılmıştı. Dördü doğru yazılmıştı, biri (yönetim
 * panelinden toplu duyuru) unutulmuştu ve izin vermemiş, hatta listeden ÇIKMIŞ
 * kullanıcılara ticari e-posta gönderiyordu. Aynı kuralı beş yerde tekrarlamak
 * er ya da geç bir yerde unutulur; bu yüzden kural artık tek yerde.
 *
 * KURAL (6563 sayılı Kanun + Ticari İletişim Yönetmeliği + KVKK + GDPR):
 * Alıcıya ticari elektronik ileti göndermek için ÖNCEDEN ONAY şarttır. Onay
 * alınmış olsa bile alıcı reddettiyse (listeden çıktıysa) gönderim durur.
 *
 * NE TİCARİ İLETİDİR: İçinde mal/hizmet tanıtımı, kampanya, indirim ya da
 * satın almaya özendirme bulunan her e-posta. "Yükseltmeyi tamamla",
 * "limitsize geç", "indirim kodun hazır" bunların hepsi ticari iletidir.
 *
 * NE DEĞİLDİR: Devam eden üyelik/abonelik, tahsilat, teslimat, şifre sıfırlama,
 * e-posta doğrulama, fatura/makbuz gibi işlem bildirimleri. Bunlar onaysız
 * gönderilebilir — ANCAK Yönetmelik md.6 gereği içlerinde hiçbir mal veya
 * hizmet özendirilemez. İşlem e-postasına "bu arada Pro'ya geç" cümlesi
 * eklendiği anda o e-posta ticari iletiye dönüşür ve bu kapıdan geçmesi
 * gerekir.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma.js";
import { assertSenderIdentityComplete } from "../modules/email/sender-identity.service.js";

/**
 * Ticari ileti alabilecek kullanıcıyı tanımlayan Prisma koşulu.
 *
 * Sorgularda `where: { ...commercialRecipientWhere(), ... }` olarak kullanılır.
 * Yeni bir toplu gönderim yazan herkes bunu eklemek zorunda; eklemezse
 * `assertCommercialConsent` gönderim anında zaten durdurur.
 *
 * `isVerified` NEDEN BURADA: Doğrulanmamış adres, kayıt formuna başkasının
 * e-postasını yazmış olabileceği için sahibine ait sayılmaz. Doğrulanmamış
 * adrese ticari ileti göndermek, izni hiç alınmamış kişiye göndermektir.
 */
export function commercialRecipientWhere(): Prisma.UserWhereInput {
  return {
    marketingConsent: true,
    marketingUnsubscribedAt: null,
    isVerified: true,
  };
}

/** Kapının verdiği karar — reddedildiyse sebebi kayda geçer. */
export type CommercialGateDecision =
  | { allowed: true }
  | { allowed: false; reason: "no_user" | "no_consent" | "unsubscribed" | "unverified" | "no_email" };

/**
 * Bu kullanıcıya ŞU AN ticari ileti gönderilebilir mi?
 *
 * Gönderimden hemen önce çağrılır. Toplu gönderimlerde liste sorgusu ile asıl
 * gönderim arasında dakikalar geçebiliyor; kullanıcı o aralıkta listeden
 * çıkmış olabilir. Ret talebinin gecikmeden işlemesi gerektiği için (mevzuat
 * 3 iş günü sınırı koyuyor, biz anında uyguluyoruz) karar gönderim anında
 * yeniden veriliyor.
 */
export async function checkCommercialConsent(userId: string): Promise<CommercialGateDecision> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      isVerified: true,
      marketingConsent: true,
      marketingUnsubscribedAt: true,
    },
  });

  if (!user) return { allowed: false, reason: "no_user" };
  if (!user.email) return { allowed: false, reason: "no_email" };
  if (user.marketingUnsubscribedAt !== null) return { allowed: false, reason: "unsubscribed" };
  if (!user.marketingConsent) return { allowed: false, reason: "no_consent" };
  if (!user.isVerified) return { allowed: false, reason: "unverified" };
  return { allowed: true };
}

/**
 * Ticari ileti göndermenin iki koşulunu birden doğrular; biri eksikse durur.
 *
 * İKİ AYRI KOŞUL:
 *   1. GÖNDEREN tarafı — zorunlu kimlik bilgileri (unvan/MERSİS ya da
 *      ad-soyad/T.C., iletişim, adres) eksiksiz mi? Eksikse HİÇ KİMSEYE
 *      gönderilemez, çünkü e-postanın kendisi mevzuata aykırı olur.
 *   2. ALICI tarafı — bu kişinin onayı var mı, çıkmamış mı?
 *
 * Sıra önemli: kimlik eksikse alıcıyı sorgulamanın anlamı yok.
 *
 * Çağıran taraf iki hatayı AYRI ele almalı: kimlik hatası işin tamamını
 * durdurur, izin hatası yalnızca o kişiyi atlatır.
 */
export async function assertCommercialConsent(userId: string): Promise<void> {
  assertSenderIdentityComplete();

  const decision = await checkCommercialConsent(userId);
  if (!decision.allowed) {
    throw new CommercialConsentError(userId, decision.reason);
  }
}

/** Kapının reddi — sıradan bir gönderim hatasından ayırt edilebilsin diye ayrı tür. */
export class CommercialConsentError extends Error {
  constructor(
    readonly userId: string,
    readonly reason: Exclude<CommercialGateDecision, { allowed: true }>["reason"],
  ) {
    super(`Ticari ileti engellendi (${reason}): ${userId}`);
    this.name = "CommercialConsentError";
  }
}
