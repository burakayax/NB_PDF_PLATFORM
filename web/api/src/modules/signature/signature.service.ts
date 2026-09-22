/**
 * BAŞKASINDAN İMZA İSTEME.
 *
 * Akış: Gönderen belgeyi yükler ve imzalayacak kişinin e-postasını yazar →
 * karşı tarafa tek kullanımlık bir bağlantı gider → o kişi belgeyi görüntüler,
 * rıza kutusunu işaretler ve imzasını çizer → SUNUCU, saklanan ÖZGÜN belgeye
 * imzayı gömer, sonuna denetim sertifikası ekler ve iki tarafa da haber verir.
 *
 * HUKUKİ DAYANAK NEYE BAĞLI: Elektronik imzanın geçerliliği dört şeyin
 * kanıtlanmasına dayanır — imzalayanın NİYETİ, açık RIZASI, imzanın KİME ait
 * olduğu ve belgenin BÜTÜNLÜĞÜ. Bu dosyadaki kararlar doğrudan bu dörtlüden
 * çıkar:
 *   • Niyet/rıza: imzalayan, ayrı bir onay kutusunu işaretlemeden imza
 *     gönderilemez; onay anı ayrı bir olay olarak kaydedilir.
 *   • Aidiyet: bağlantı yalnız o e-posta adresine gider, tek kullanımlıktır ve
 *     her erişimin zamanı, ağ özeti ve tarayıcı bilgisi kaydedilir.
 *   • Bütünlük: imza, imzalayandan gelen bir dosyaya değil, SUNUCUDA saklanan
 *     özgün belgeye uygulanır; belgenin imzadan önceki ve sonraki parmak izleri
 *     (SHA-256) saklanır ve sertifikaya yazılır.
 *
 * KAPSAM: Bu, görsel (ıslak imza görünümlü) elektronik imzadır. Nitelikli
 * elektronik imza (e-imza) ayrı bir hukuki kategoridir ve nitelikli hizmet
 * sağlayıcısından alınan sertifika gerektirir; kullanıcıya bu ayrım açıkça
 * söylenir, aksi hâlde yanlış beklenti oluşur.
 */
import { createHash } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { createUrlSafeToken, hashToken } from "../../lib/token.js";
import { sendMail } from "../../lib/mailer.js";
import { logger } from "../../lib/file-log.js";
import { bufferToBytes } from "../../lib/bytes.js";
import { imzaliBelgeUret, sha256, type ImzaYerlesimi } from "./signature.pdf.js";



/** Bağlantının geçerlilik süresi (gün). */
const GECERLILIK_GUN = 14;
/** Belge boyutu üst sınırı (veritabanında saklandığı için sınırlı tutulur). */
const EN_BUYUK_BELGE = 15 * 1024 * 1024;

/**
 * AYLIK İMZA İSTEĞİ KONTENJANI.
 *
 * İmza isteme, cihazda çalışan araçlardan farklı: belge sunucuda saklanır ve her
 * istek e-posta gönderir — yani gerçek bir maliyeti vardır. Ayrıca sözleşme
 * imzalatan kişi tanım gereği iş yapıyordur; ürünün ücretli tarafının karşılığı
 * burasıdır.
 *
 * Ücretsiz planda 1: "tadına bakma" hakkı. Deneyemeyen kullanıcı, ödemeye değip
 * değmeyeceğini de bilemez.
 */
const AYLIK_KONTENJAN: Record<string, number | null> = {
  FREE: 1,
  STARTER: 3,
  PLUS: 10,
  PRO: 20,
  BUSINESS: null, // sınırsız
};

function ayBasi(): Date {
  const simdi = new Date();
  return new Date(Date.UTC(simdi.getUTCFullYear(), simdi.getUTCMonth(), 1));
}

/** Bu ay kaç istek gönderilmiş ve hak kaldı mı. */
export async function imzaKontenjani(ownerId: string): Promise<{
  kullanilan: number;
  sinir: number | null;
  kaldi: number | null;
}> {
  const kullanici = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { plan: true, role: true },
  });
  // DİKKAT: Tabloda `null` "sınırsız" demek. `??` kullanılırsa null da "değer
  // yok" sayılır ve Business planı 1 isteğe düşerdi (test yakaladı).
  const plan = kullanici?.plan ?? "FREE";
  const sinir =
    kullanici?.role === "ADMIN"
      ? null
      : plan in AYLIK_KONTENJAN
        ? AYLIK_KONTENJAN[plan]!
        : 1;
  const kullanilan = await prisma.signatureRequest.count({
    where: { ownerId, createdAt: { gte: ayBasi() } },
  });
  return { kullanilan, sinir, kaldi: sinir === null ? null : Math.max(0, sinir - kullanilan) };
}

export type IstekBilgisi = {
  userAgent?: string | null;
  ip?: string | null;
};

function ipOzeti(ip?: string | null): string | null {
  return ip ? createHash("sha256").update(ip).digest("hex") : null;
}

function imzaBaglantisi(token: string): string {
  return `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/imzala/${token}`;
}

async function olayYaz(
  requestId: string,
  type: string,
  bilgi: IstekBilgisi = {},
  ek: { detail?: string; actor?: string } = {},
): Promise<void> {
  await prisma.signatureEvent.create({
    data: {
      requestId,
      type,
      ipHash: ipOzeti(bilgi.ip),
      userAgent: bilgi.userAgent ? bilgi.userAgent.slice(0, 300) : null,
      detail: ek.detail ?? null,
      actor: ek.actor ?? null,
    },
  });
}

/* ─────────────────────────── GÖNDEREN TARAFI ─────────────────────────── */

export async function imzaIstegiOlustur(
  ownerId: string,
  girdi: {
    belge: Buffer;
    filename: string;
    title: string;
    signerEmail: string;
    signerName?: string;
    message?: string;
  },
  bilgi: IstekBilgisi = {},
): Promise<{ id: string; baglanti: string }> {
  if (!girdi.belge?.length) throw new HttpError(400, "Belge gerekli.");
  if (girdi.belge.length > EN_BUYUK_BELGE) {
    throw new HttpError(413, "Belge çok büyük (en fazla 15 MB).");
  }
  if (girdi.belge.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new HttpError(400, "Yalnızca PDF belgeler imzaya gönderilebilir.");
  }
  const eposta = (girdi.signerEmail || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(eposta)) {
    throw new HttpError(400, "Geçerli bir e-posta adresi gerekli.");
  }

  const gonderen = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { email: true, name: true, firstName: true },
  });
  if (!gonderen) throw new HttpError(404, "Kullanıcı bulunamadı.");

  const kontenjan = await imzaKontenjani(ownerId);
  if (kontenjan.sinir !== null && kontenjan.kullanilan >= kontenjan.sinir) {
    throw new HttpError(
      402,
      `Bu ay için imza isteği hakkınız doldu (${kontenjan.sinir}). ` +
        `Planınızı yükselterek daha fazla belge imzalatabilirsiniz.`,
    );
  }

  const token = createUrlSafeToken(32);
  const istek = await prisma.signatureRequest.create({
    data: {
      ownerId,
      title: (girdi.title || girdi.filename || "Belge").slice(0, 200),
      filename: (girdi.filename || "belge.pdf").slice(0, 200),
      originalData: bufferToBytes(girdi.belge),
      originalHash: sha256(girdi.belge),
      message: (girdi.message || "").slice(0, 1000) || null,
      signerEmail: eposta,
      signerName: (girdi.signerName || "").trim().slice(0, 120) || null,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + GECERLILIK_GUN * 24 * 60 * 60 * 1000),
    },
    select: { id: true, title: true },
  });

  await olayYaz(istek.id, "created", bilgi, {
    actor: gonderen.email,
    detail: `Belge parmak izi kaydedildi`,
  });

  const baglanti = imzaBaglantisi(token);
  const gonderenAd = gonderen.name || gonderen.firstName || gonderen.email;
  await sendMail({
    to: eposta,
    replyTo: gonderen.email,
    subject: `${gonderenAd} imzanızı bekliyor: ${istek.title}`,
    text:
      `${gonderenAd} (${gonderen.email}) bir belgeyi imzalamanızı istiyor: ${istek.title}\n\n` +
      (girdi.message ? `Notu: ${girdi.message}\n\n` : "") +
      `Belgeyi görüntülemek ve imzalamak için: ${baglanti}\n\n` +
      `Bağlantı ${GECERLILIK_GUN} gün geçerlidir ve yalnızca sizin için üretilmiştir.`,
    html:
      `<p><strong>${gonderenAd}</strong> (${gonderen.email}) bir belgeyi imzalamanızı istiyor:</p>` +
      `<p style="font-size:16px"><strong>${istek.title}</strong></p>` +
      (girdi.message ? `<p style="color:#475569">Notu: ${girdi.message}</p>` : "") +
      `<p><a href="${baglanti}" style="display:inline-block;background:#0891b2;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">Belgeyi görüntüle ve imzala</a></p>` +
      `<p style="color:#64748b;font-size:13px">Bağlantı ${GECERLILIK_GUN} gün geçerlidir ve yalnızca sizin için üretilmiştir.</p>`,
  });
  await olayYaz(istek.id, "sent", bilgi, { actor: eposta });

  logger.info("imza", "istek oluşturuldu", { id: istek.id, ownerId });
  return { id: istek.id, baglanti };
}

export async function imzaIstekleriniListele(ownerId: string) {
  const kayitlar = await prisma.signatureRequest.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      filename: true,
      status: true,
      signerEmail: true,
      signerName: true,
      createdAt: true,
      viewedAt: true,
      signedAt: true,
      declinedAt: true,
      declineReason: true,
      expiresAt: true,
    },
  });
  const simdi = new Date();
  return kayitlar.map((k) => ({
    ...k,
    // Süresi geçmiş ama hâlâ bekleyen istekler listede "süresi doldu" görünür.
    status: k.status === "PENDING" && k.expiresAt < simdi ? "EXPIRED" : k.status,
  }));
}

export async function imzaIstegiDetayi(ownerId: string, id: string) {
  const istek = await prisma.signatureRequest.findFirst({
    where: { id, ownerId },
    select: {
      id: true,
      title: true,
      filename: true,
      status: true,
      signerEmail: true,
      signerName: true,
      message: true,
      originalHash: true,
      signedHash: true,
      createdAt: true,
      viewedAt: true,
      signedAt: true,
      declinedAt: true,
      declineReason: true,
      expiresAt: true,
      events: { orderBy: { at: "asc" }, select: { type: true, at: true, detail: true, actor: true } },
    },
  });
  if (!istek) throw new HttpError(404, "İmza isteği bulunamadı.");
  return istek;
}

export async function imzaIstegiIptal(ownerId: string, id: string, bilgi: IstekBilgisi = {}) {
  const istek = await prisma.signatureRequest.findFirst({ where: { id, ownerId }, select: { id: true, status: true } });
  if (!istek) throw new HttpError(404, "İmza isteği bulunamadı.");
  if (istek.status === "SIGNED") throw new HttpError(409, "İmzalanmış bir istek iptal edilemez.");
  await prisma.signatureRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  await olayYaz(id, "cancelled", bilgi);
}

/** İmzalı (yoksa özgün) belgeyi indirir. */
export async function imzaBelgesiniIndir(ownerId: string, id: string, bilgi: IstekBilgisi = {}) {
  const istek = await prisma.signatureRequest.findFirst({
    where: { id, ownerId },
    select: { id: true, filename: true, signedData: true, originalData: true, status: true },
  });
  if (!istek) throw new HttpError(404, "İmza isteği bulunamadı.");
  const imzali = Boolean(istek.signedData);
  await olayYaz(id, "downloaded", bilgi, { detail: imzali ? "imzalı belge" : "özgün belge" });
  return {
    filename: imzali ? istek.filename.replace(/\.pdf$/i, "") + "-imzali.pdf" : istek.filename,
    data: (istek.signedData ?? istek.originalData) as Buffer,
  };
}

/* ─────────────────────────── İMZALAYAN TARAFI ─────────────────────────── */

async function tokenlaBul(token: string) {
  const istek = await prisma.signatureRequest.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      title: true,
      filename: true,
      message: true,
      status: true,
      signerEmail: true,
      signerName: true,
      expiresAt: true,
      originalData: true,
      originalHash: true,
      owner: { select: { email: true, name: true, firstName: true } },
    },
  });
  if (!istek) throw new HttpError(404, "Bu imza bağlantısı geçersiz.");
  return istek;
}

/** İmzalayan bağlantıyı açtığında: belgeyi döndürür ve görüntülemeyi kaydeder. */
export async function imzaSayfasiniAc(token: string, bilgi: IstekBilgisi = {}) {
  const istek = await tokenlaBul(token);

  if (istek.status === "CANCELLED") throw new HttpError(410, "Bu imza isteği iptal edilmiş.");
  if (istek.status === "DECLINED") throw new HttpError(410, "Bu imza isteği daha önce reddedilmiş.");
  if (istek.expiresAt < new Date() && istek.status !== "SIGNED") {
    throw new HttpError(410, "Bu imza bağlantısının süresi dolmuş.");
  }

  if (istek.status === "PENDING") {
    await prisma.signatureRequest.update({
      where: { id: istek.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    await olayYaz(istek.id, "viewed", bilgi, { actor: istek.signerEmail });
  }

  const isteyen = istek.owner;
  return {
    id: istek.id,
    title: istek.title,
    filename: istek.filename,
    message: istek.message,
    status: istek.status === "PENDING" ? "VIEWED" : istek.status,
    signerEmail: istek.signerEmail,
    signerName: istek.signerName,
    isteyen: isteyen.name || isteyen.firstName || isteyen.email,
    isteyenEposta: isteyen.email,
    belgeBase64: (istek.originalData as Buffer).toString("base64"),
    imzalandiMi: istek.status === "SIGNED",
  };
}

/**
 * İmzayı uygular.
 *
 * İmzalayandan yalnızca imza GÖRÜNTÜSÜ, adı, rızası ve imzanın nereye
 * konulacağı alınır; belgenin kendisi sunucudakinden okunur.
 */
export async function imzayiUygula(
  token: string,
  girdi: {
    imzaPngBase64: string;
    imzalayanAd: string;
    yerlesim: ImzaYerlesimi;
    riza: boolean;
  },
  bilgi: IstekBilgisi = {},
): Promise<{ id: string }> {
  const istek = await tokenlaBul(token);

  if (istek.status === "SIGNED") throw new HttpError(409, "Bu belge zaten imzalanmış.");
  if (istek.status === "CANCELLED") throw new HttpError(410, "Bu imza isteği iptal edilmiş.");
  if (istek.expiresAt < new Date()) throw new HttpError(410, "Bu imza bağlantısının süresi dolmuş.");

  // RIZA: açık onay olmadan imza uygulanmaz — hukuki dayanağın temel şartı.
  if (!girdi.riza) throw new HttpError(400, "İmzalamak için onay kutusunu işaretlemeniz gerekir.");

  const ad = (girdi.imzalayanAd || "").trim();
  if (ad.length < 2) throw new HttpError(400, "Ad soyad gerekli.");

  const temiz = girdi.imzaPngBase64.replace(/^data:image\/png;base64,/, "");
  let imzaPng: Buffer;
  try {
    imzaPng = Buffer.from(temiz, "base64");
  } catch {
    throw new HttpError(400, "İmza görüntüsü okunamadı.");
  }
  if (imzaPng.length < 64 || imzaPng.length > 2 * 1024 * 1024) {
    throw new HttpError(400, "İmza görüntüsü geçersiz.");
  }

  // Rıza ve imza ayrı olaylar olarak kaydedilir (niyetin kanıtı).
  await olayYaz(istek.id, "consent", bilgi, {
    actor: `${ad} <${istek.signerEmail}>`,
    detail: "Onay kutusu işaretlendi",
  });

  const olaylar = await prisma.signatureEvent.findMany({
    where: { requestId: istek.id },
    orderBy: { at: "asc" },
    select: { type: true, at: true, detail: true, actor: true, ipHash: true, userAgent: true },
  });

  const imzaZamani = new Date();
  const imzali = await imzaliBelgeUret({
    ozgunPdf: new Uint8Array(istek.originalData as Buffer),
    imzaPng: new Uint8Array(imzaPng),
    yerlesim: girdi.yerlesim,
    imzalayanAd: ad,
    imzalayanEposta: istek.signerEmail,
    isteyenAd: istek.owner.name || istek.owner.firstName || "",
    isteyenEposta: istek.owner.email,
    belgeAdi: istek.title,
    ozgunOzet: istek.originalHash,
    olaylar: [...olaylar, { type: "signed", at: imzaZamani, actor: `${ad} <${istek.signerEmail}>` }],
    imzaZamani,
  });

  const imzaliBuf = Buffer.from(imzali);
  await prisma.signatureRequest.update({
    where: { id: istek.id },
    data: {
      status: "SIGNED",
      signedAt: imzaZamani,
      signedData: imzaliBuf,
      signedHash: sha256(imzaliBuf),
      signerName: ad,
    },
  });
  await olayYaz(istek.id, "signed", bilgi, { actor: `${ad} <${istek.signerEmail}>` });

  // İki tarafa da haber ver — imzalayanın elinde de kopyası olmalı.
  const konu = `İmzalandı: ${istek.title}`;
  const govde =
    `«${istek.title}» belgesi ${ad} tarafından imzalandı.\n\n` +
    `İmzalı belge, imzalama sürecinin zaman damgalı kaydını taşıyan bir denetim ` +
    `sertifikası sayfasıyla birlikte hesabınızda hazır.`;
  await sendMail({
    to: istek.owner.email,
    subject: konu,
    text: govde,
    html: `<p>«<strong>${istek.title}</strong>» belgesi <strong>${ad}</strong> tarafından imzalandı.</p><p style="color:#475569">İmzalı belge, denetim sertifikasıyla birlikte hesabınızda hazır.</p>`,
  }).catch(() => undefined);
  await sendMail({
    to: istek.signerEmail,
    subject: konu,
    text: `«${istek.title}» belgesini imzaladınız. Bir kopyası isteği gönderen tarafa iletildi.`,
    html: `<p>«<strong>${istek.title}</strong>» belgesini imzaladınız. Bir kopyası isteği gönderen tarafa iletildi.</p>`,
  }).catch(() => undefined);

  logger.info("imza", "belge imzalandı", { id: istek.id });
  return { id: istek.id };
}

/** İmzalayan reddederse. */
export async function imzayiReddet(
  token: string,
  sebep: string,
  bilgi: IstekBilgisi = {},
): Promise<void> {
  const istek = await tokenlaBul(token);
  if (istek.status === "SIGNED") throw new HttpError(409, "Bu belge zaten imzalanmış.");
  await prisma.signatureRequest.update({
    where: { id: istek.id },
    data: {
      status: "DECLINED",
      declinedAt: new Date(),
      declineReason: (sebep || "").slice(0, 500) || null,
    },
  });
  await olayYaz(istek.id, "declined", bilgi, {
    actor: istek.signerEmail,
    detail: (sebep || "").slice(0, 200) || undefined,
  });
  await sendMail({
    to: istek.owner.email,
    subject: `İmza reddedildi: ${istek.title}`,
    text: `«${istek.title}» için imza isteği reddedildi.` + (sebep ? `\n\nBelirtilen sebep: ${sebep}` : ""),
    html: `<p>«<strong>${istek.title}</strong>» için imza isteği reddedildi.</p>` + (sebep ? `<p style="color:#475569">Belirtilen sebep: ${sebep}</p>` : ""),
  }).catch(() => undefined);
}

/** İmzalayan kendi kopyasını indirebilsin (imzaladıktan sonra). */
export async function imzalayanKopyasi(token: string) {
  const istek = await prisma.signatureRequest.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { filename: true, signedData: true, status: true },
  });
  if (!istek || istek.status !== "SIGNED" || !istek.signedData) {
    throw new HttpError(404, "İmzalı belge bulunamadı.");
  }
  return {
    filename: istek.filename.replace(/\.pdf$/i, "") + "-imzali.pdf",
    data: istek.signedData as Buffer,
  };
}
