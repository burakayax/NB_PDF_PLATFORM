/**
 * HESAP PAYLAŞIMI SİNYALİ — "bu hesap kaç farklı cihazda kullanılmış?"
 *
 * NEDEN BÖYLE ÖLÇÜLÜYOR: Eşzamanlı oturum sayısına bakmak paylaşımı yakalamaz;
 * bir hesabı paylaşan kişiler genelde aynı anda değil sırayla girer ve makul bir
 * sınırın altında rahatça kalırlar. Paylaşımın ayırt edici izi, hesapta ZAMAN
 * İÇİNDE biriken FARKLI CİHAZ sayısıdır: normal bir kullanıcı aylar boyunca
 * birkaç cihaz ekler, paylaşılan hesapta ise günler içinde çok sayıda farklı
 * cihaz ve ağ görünür.
 *
 * NE YAPMIYOR: Hiçbir hesabı kendiliğinden kapatmaz, kısıtlamaz veya uyarı
 * göndermez. Yalnızca yöneticiye GÖRÜNÜRLÜK verir — karar insana aittir.
 * Yanlış işaretleme ihtimali gerçektir (ofiste ortak ağ, sık tarayıcı
 * güncellemesi, gizli sekme, cihaz yenileme), bu yüzden otomatik yaptırım yok.
 */
import { prisma } from "../../lib/prisma.js";

export type PaylasimSinyali = {
  /** Kaç günlük pencereye bakıldı. */
  pencereGun: number;
  /** Bu pencerede görülen farklı cihaz sayısı. */
  cihazSayisi: number;
  /** Bu pencerede görülen farklı ağ sayısı. */
  agSayisi: number;
  /** Şu anda açık oturum sayısı. */
  acikOturum: number;
  /** "normal" | "izlenmeli" | "yuksek" */
  risk: "normal" | "izlenmeli" | "yuksek";
  /** Yöneticiye gösterilecek tek cümlelik açıklama. */
  aciklama: string;
};

/** Bu eşiklerin üstü "olağandışı" sayılır (yaptırım değil, dikkat çekme). */
const IZLENMELI_CIHAZ = 5;
const YUKSEK_CIHAZ = 8;
const YUKSEK_AG = 12;

export async function hesapPaylasimSinyali(
  userId: string,
  pencereGun = 30,
): Promise<PaylasimSinyali> {
  const baslangic = new Date(Date.now() - pencereGun * 24 * 60 * 60 * 1000);
  const kayitlar = await prisma.refreshToken.findMany({
    where: { userId, createdAt: { gte: baslangic } },
    select: { deviceKey: true, ipHash: true, revokedAt: true, expiresAt: true },
  });

  const cihazlar = new Set<string>();
  const aglar = new Set<string>();
  let acikOturum = 0;
  const simdi = new Date();
  for (const k of kayitlar) {
    if (k.deviceKey) cihazlar.add(k.deviceKey);
    if (k.ipHash) aglar.add(k.ipHash);
    if (!k.revokedAt && k.expiresAt > simdi) acikOturum += 1;
  }

  const cihazSayisi = cihazlar.size;
  const agSayisi = aglar.size;
  const risk: PaylasimSinyali["risk"] =
    cihazSayisi >= YUKSEK_CIHAZ || agSayisi >= YUKSEK_AG
      ? "yuksek"
      : cihazSayisi >= IZLENMELI_CIHAZ
        ? "izlenmeli"
        : "normal";

  const aciklama =
    risk === "yuksek"
      ? `Son ${pencereGun} günde ${cihazSayisi} farklı cihaz ve ${agSayisi} farklı ağ görüldü — tek kişilik kullanım için olağandışı.`
      : risk === "izlenmeli"
        ? `Son ${pencereGun} günde ${cihazSayisi} farklı cihaz görüldü — sıra dışı ama tek başına paylaşım kanıtı değil.`
        : `Son ${pencereGun} günde ${cihazSayisi} farklı cihaz — olağan kullanım.`;

  return { pencereGun, cihazSayisi, agSayisi, acikOturum, risk, aciklama };
}
