/**
 * Ticari e-postalarda görünen GÖNDEREN KİMLİK BİLGİLERİ.
 *
 * NEDEN VERİTABANINDA, ORTAM DEĞİŞKENİNDE DEĞİL: Bu bilgiler işletmenin resmî
 * kimliği — unvan, MERSİS/T.C., iletişim. Şahıs firmasından şirkete geçişte,
 * adres veya telefon değişiminde güncellenmesi gerekir. Sunucu dosyasını
 * elle düzenleyip yeniden başlatmayı gerektiren bir alan, pratikte hiç
 * güncellenmeyen bir alandır. Yönetim panelinden girilir, anında geçerli olur.
 *
 * NEDEN ÖNBELLEKLİ: E-posta şablonu senkron çalışıyor (HTML üretimi sırasında
 * veritabanı beklenemez). Değerler bellekte tutulur; her yazmada ve sunucu
 * açılışında tazelenir.
 *
 * MEVZUAT (Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik
 * md.7): Tanıtım içeren her e-postada şunlar ZORUNLU —
 *   - Şirket: ticaret unvanı + MERSİS numarası
 *   - Esnaf/şahıs işletmesi: ad soyad + T.C. kimlik numarası
 *   - Telefon veya e-posta adresinden en az biri
 */

import { prisma } from "../../lib/prisma.js";
import { getSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import { logger } from "../../lib/file-log.js";

export type SenderIdentity = {
  /** Şirketse ticaret unvanı, şahıs işletmesiyse ad soyad. */
  legalName: string;
  /** "company" = unvan + MERSİS, "sole" = ad soyad + T.C. kimlik no. */
  entityType: "company" | "sole";
  /** Yalnız entityType "company" ise kullanılır. */
  mersisNo: string;
  /** Yalnız entityType "sole" ise kullanılır. */
  tckn: string;
  phone: string;
  contactEmail: string;
  postalAddress: string;
};

export const EMPTY_SENDER_IDENTITY: SenderIdentity = {
  legalName: "",
  entityType: "sole",
  mersisNo: "",
  tckn: "",
  phone: "",
  contactEmail: "",
  postalAddress: "",
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function normalizeSenderIdentity(raw: unknown): SenderIdentity {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SENDER_IDENTITY };
  const o = raw as Record<string, unknown>;
  return {
    legalName: str(o.legalName),
    entityType: o.entityType === "company" ? "company" : "sole",
    // Rakam dışındaki karakterler temizlenir: "1234 5678" ile "12345678" aynı.
    mersisNo: str(o.mersisNo).replace(/\D/g, ""),
    tckn: str(o.tckn).replace(/\D/g, ""),
    phone: str(o.phone),
    contactEmail: str(o.contactEmail),
    postalAddress: str(o.postalAddress),
  };
}

/**
 * Senkron okuma için bellekteki kopya.
 *
 * Sunucu açılışında `primeSenderIdentity` ile doldurulur; henüz dolmadıysa
 * boş kimlik döner ve eksik sayılır — yani gönderim durur. Bilinmeyen durumda
 * göndermemek, yanlış bilgiyle göndermekten güvenli.
 */
let cached: SenderIdentity = { ...EMPTY_SENDER_IDENTITY };

/** Şablonların kullandığı senkron erişim. */
export function senderIdentity(): SenderIdentity {
  return cached;
}

/** Veritabanından okuyup bellekteki kopyayı tazeler. */
export async function refreshSenderIdentity(): Promise<SenderIdentity> {
  const raw = await getSetting(SITE_SETTING_KEYS.EMAIL_SENDER_IDENTITY);
  cached = normalizeSenderIdentity(raw);
  return cached;
}

/** Sunucu açılışında çağrılır; hata alırsa boş kimlikle devam eder. */
export async function primeSenderIdentity(): Promise<void> {
  try {
    await refreshSenderIdentity();
  } catch (err) {
    logger.error("sender-identity", "gönderen kimliği okunamadı", { detail: String(err) });
  }
}

/** Yönetim panelinin okuduğu güncel değer (önbelleği atlar). */
export async function readSenderIdentity(): Promise<SenderIdentity> {
  const raw = await getSetting(SITE_SETTING_KEYS.EMAIL_SENDER_IDENTITY);
  return normalizeSenderIdentity(raw);
}

/** Yönetim panelinden kaydeder ve belleği anında tazeler. */
export async function writeSenderIdentity(input: unknown): Promise<SenderIdentity> {
  const value = normalizeSenderIdentity(input);
  await prisma.siteSetting.upsert({
    where: { key: SITE_SETTING_KEYS.EMAIL_SENDER_IDENTITY },
    create: { key: SITE_SETTING_KEYS.EMAIL_SENDER_IDENTITY, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  // getSetting'in kendi kısa ömürlü önbelleği var; doğrudan yazarak
  // panelde "kaydettim ama e-postada eski bilgi çıkıyor" durumunu önlüyoruz.
  cached = value;
  return value;
}

/**
 * Eksik zorunlu alanların insan tarafından okunabilir listesi.
 *
 * Boş dizi = e-posta göndermeye hazır.
 */
export function missingSenderIdentityFields(identity: SenderIdentity = cached): string[] {
  const missing: string[] = [];

  if (!identity.legalName) {
    missing.push(identity.entityType === "company" ? "Ticaret unvanı" : "Ad soyad");
  }
  if (identity.entityType === "company") {
    if (!identity.mersisNo) missing.push("MERSİS numarası");
  } else if (!identity.tckn) {
    missing.push("T.C. kimlik numarası");
  }
  // İletişim bilgilerinden en az biri yeterli.
  if (!identity.phone && !identity.contactEmail) {
    missing.push("Telefon veya iletişim e-postası");
  }
  if (!identity.postalAddress) {
    missing.push("Posta adresi");
  }

  return missing;
}

/** Ticari e-posta gönderilebilir mi — kimlik tarafı. */
export function isSenderIdentityComplete(identity: SenderIdentity = cached): boolean {
  return missingSenderIdentityFields(identity).length === 0;
}

/** Kimlik eksikse gönderimi durdurur. */
export function assertSenderIdentityComplete(): void {
  const missing = missingSenderIdentityFields();
  if (missing.length > 0) {
    throw new SenderIdentityError(missing);
  }
}

/**
 * Kimlik eksikliği hatası.
 *
 * İzin hatasından (CommercialConsentError) ayrı tür: o "bu kişiye
 * gönderilemez" demek, bu "hiç kimseye gönderilemez" demek. Toplu gönderimde
 * ilki tek kişiyi atlatır, ikincisi işin tamamını durdurmalı.
 */
export class SenderIdentityError extends Error {
  constructor(readonly missing: string[]) {
    super(
      `Ticari e-posta gönderilemez — gönderen kimlik bilgileri eksik: ${missing.join(", ")}. ` +
        `Yönetim paneli → E-postalar → Gönderen kimliği bölümünden tamamlayın.`,
    );
    this.name = "SenderIdentityError";
  }
}
